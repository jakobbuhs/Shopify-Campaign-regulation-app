// src/webhookVerifier.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Verify Shopify webhook HMAC.
 * Throws if validation fails; otherwise calls next().
 */
export function verifyShopifyWebhook(secret: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const hmacHeader =
        (req.headers['x-shopify-hmac-sha256'] as string) || '';

      const hash = crypto
        .createHmac('sha256', secret)
        .update((req.body as Buffer).toString('utf8'))
        .digest('base64');

      if (hash !== hmacHeader) {
        throw new Error('Webhook HMAC validation failed');
      }

      next(); // validation passed
    } catch (err) {
      next(err);
    }
  };
}
