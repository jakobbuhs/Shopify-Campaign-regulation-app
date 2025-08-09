// server.ts - Express server with Shopify webhook, health check, and HMAC verification

import express, { Request, Response } from 'express';
import { PrismaClient, PriceChangeSource, Prisma } from '@prisma/client';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { verifyShopifyWebhook } from './webhookVerifier';
import createCampaignRouter from './campaigns/create/createCampaign';
import listCampaignsRouter from './campaigns/list/listCampaigns';
import listProductsRouter from './products/listProducts';
import cors from 'cors';



dotenv.config();

const app = express();
const prisma = new PrismaClient();
const secret = process.env.SHOPIFY_API_SECRET || '';

// Default root
app.get('/', (_req: Request, res: Response) => {
  res.send('🚀 Shopify Campaign App is running!');
});

// Health route
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).send('OK!');
});

// Raw body middleware for webhook
app.use('/webhooks/products/update', express.raw({ type: 'application/json' }));
app.use(express.json()); // Make sure this comes before the route
app.use(createCampaignRouter);
app.use(listCampaignsRouter);

app.use(cors({
    origin: [process.env.APP_URL || '*']
  }));
  
  app.use(listProductsRouter);

// Webhook route with HMAC verifier middleware
app.post(
  '/webhooks/products/update',
  verifyShopifyWebhook(secret),
  async (req: Request, res: Response) => {
    try {
      const payload = JSON.parse((req.body as Buffer).toString());
      const variants = payload.variants || [];

      await Promise.all(
        variants.map((variant: any) =>
          prisma.priceHistory.create({
            data: {
              variantId: variant.id.toString(),
              price: new Prisma.Decimal(variant.price),
              compareAtPrice: variant.compare_at_price
                ? new Prisma.Decimal(variant.compare_at_price)
                : null,
              changedBy: PriceChangeSource.MERCHANT,
              changedAt: new Date(payload.updated_at),
              campaignId: null,
            },
          })
        )
      );

      console.log('✅ Price history recorded');
      res.status(200).send('OK');
    } catch (err) {
      console.error('❌ Webhook error:', err);
      res.status(500).send('Error processing webhook');
    }
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 App running on port ${PORT}`);
});
