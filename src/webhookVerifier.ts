import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function verifyShopifyWebhook(secret: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string;

    const generatedHash = crypto
      .createHmac('sha256', secret)
      .update(req.body as Buffer)
      .digest('base64');

    if (generatedHash !== hmacHeader) {
      console.error('❌ Webhook HMAC validation failed');
      return _res.status(401).send('Unauthorized');
    }

    next();
  };
}
