"use strict";
// server.ts - Express server with Shopify webhook and health check
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
const crypto_1 = __importDefault(require("crypto"));
// Load env vars
dotenv_1.default.config();
// Initialize Express and Prisma
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
// Middleware to parse raw body for webhook validation
app.use('/webhooks/products/update', express_1.default.raw({ type: 'application/json' }));
// Health check
app.get('/health', (_req, res) => {
    res.status(200).send('OK!');
});
// Shopify HMAC verification function
function verifyShopifyWebhook(req, res, buf) {
    const hmacHeader = req.get('X-Shopify-Hmac-Sha256') || '';
    const generatedHash = crypto_1.default
        .createHmac('sha256', process.env.SHOPIFY_API_SECRET || '')
        .update(buf)
        .digest('base64');
    if (generatedHash !== hmacHeader) {
        throw new Error('Webhook HMAC validation failed');
    }
}
// Webhook handler for products/update
app.post('/webhooks/products/update', (req, res) => {
    try {
        verifyShopifyWebhook(req, res, req.body);
        const payload = JSON.parse(req.body.toString());
        const variants = payload.variants || [];
        Promise.all(variants.map((variant) => prisma.priceHistory.create({
            data: {
                variantId: variant.id.toString(),
                price: new client_1.Prisma.Decimal(variant.price),
                compareAtPrice: variant.compare_at_price
                    ? new client_1.Prisma.Decimal(variant.compare_at_price)
                    : null,
                changedBy: client_1.PriceChangeSource.MERCHANT,
                changedAt: new Date(payload.updated_at),
                campaignId: null,
            },
        })))
            .then(() => {
            console.log('✅ Price history recorded');
            res.status(200).send('OK');
        })
            .catch((err) => {
            console.error('❌ Error saving price history:', err);
            res.status(500).send('Failed to save price history');
        });
    }
    catch (err) {
        console.error('❌ Webhook error:', err);
        res.status(401).send('Unauthorized');
    }
});
// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
