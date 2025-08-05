// server.ts - Express server with Shopify webhook and health check

import express from 'express';
import { Request, Response } from 'express';
import { PrismaClient, PriceChangeSource, Prisma } from '@prisma/client';

import dotenv from 'dotenv';
import crypto from 'crypto';

// Load env vars
dotenv.config();

// Initialize Express and Prisma
const app = express();
const prisma = new PrismaClient();

// Middleware to parse raw body for webhook validation
app.use('/webhooks/products/update', express.raw({ type: 'application/json' }));

// Health check
app.get('/health', (_req, res) => {
  res.status(200).send('OK!');
});

// Shopify HMAC verification function
function verifyShopifyWebhook(req: express.Request, res: express.Response, buf: Buffer) {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256') || '';
  const generatedHash = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET || '')
    .update(buf)
    .digest('base64');

  if (generatedHash !== hmacHeader) {
    throw new Error('Webhook HMAC validation failed');
  }
}

// Webhook handler for products/update
app.post('/webhooks/products/update', (req: Request, res: Response) => {

  try {
    verifyShopifyWebhook(req, res, req.body);

    const payload = JSON.parse(req.body.toString());
    const variants = payload.variants || [];

    Promise.all(
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

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
