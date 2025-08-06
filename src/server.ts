// server.ts - Express server with Shopify webhook, health check, and default root

import express, { Request, Response } from 'express';
import { PrismaClient, PriceChangeSource } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { verifyShopifyWebhook } from './webhookVerifier';

const secret = process.env.SHOPIFY_API_SECRET || '';

app.post(
  '/webhooks/products/update',
  express.raw({ type: 'application/json' }),
  verifyShopifyWebhook(secret),
  (req, res) => {
    const payload = JSON.parse((req.body as Buffer).toString());
    // ...save to DB...
    res.status(200).send('OK');
  }
);

dotenv.config();

// Initialize Express and Prisma
const app = express();
const prisma = new PrismaClient();

// 👉 Default root route so / returns a friendly message
app.get('/', (_req: Request, res: Response) => {
  res.send('🚀 Shopify Campaign App is running!');
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).send('OK!');
});

// Parse raw body for webhook verification only on this route
app.use('/webhooks/products/update', express.raw({ type: 'application/json' }));

// Verify Shopify HMAC
function verifyShopifyWebhook(req: Request, _res: Response, buf: Buffer) {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256') || '';
  const generatedHash = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET || '')
    .update(buf)
    .digest('base64');

  if (generatedHash !== hmacHeader) {
    throw new Error('Webhook HMAC validation failed');
  }
}

// Webhook handler
app.post('/webhooks/products/update', (req: Request, res: Response) => {
  try {
    verifyShopifyWebhook(req, res, req.body as Buffer);

    const payload = JSON.parse((req.body as Buffer).toString());
    const variants = payload.variants || [];

    Promise.all(
      variants.map((variant: any) =>
        prisma.priceHistory.create({
          data: {
            price: new Decimal(variant.price),
            compareAtPrice: variant.compare_at_price ? new Decimal(variant.compare_at_price) : null,
            changedBy: PriceChangeSource.MERCHANT,
            changedAt: new Date(payload.updated_at),
            campaignId: null,
          },
        })
      )
    )
      .then(() => {
        console.log('✅ Price history recorded');
        res.status(200).send('OK');
      })
      .catch((err) => {
        console.error('❌ Error saving price history:', err);
        res.status(500).send('Failed to save price history');
      });
  } catch (err) {
    console.error('❌ Webhook error:', err);
    res.status(401).send('Unauthorized');
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 App running on port ${PORT}`);
});
