"use strict";
// server.ts - Express server with Shopify webhook, health check, and HMAC verification
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
const webhookVerifier_1 = require("./webhookVerifier");
dotenv_1.default.config();
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const secret = process.env.SHOPIFY_API_SECRET || '';
// Default root
app.get('/', (_req, res) => {
    res.send('🚀 Shopify Campaign App is running!');
});
// Health route
app.get('/health', (_req, res) => {
    res.status(200).send('OK!');
});
// Raw body middleware for webhook
app.use('/webhooks/products/update', express_1.default.raw({ type: 'application/json' }));
// Webhook route with HMAC verifier middleware
app.post('/webhooks/products/update', (0, webhookVerifier_1.verifyShopifyWebhook)(secret), async (req, res) => {
    try {
        const payload = JSON.parse(req.body.toString());
        const variants = payload.variants || [];
        await Promise.all(variants.map((variant) => prisma.priceHistory.create({
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
        })));
        console.log('✅ Price history recorded');
        res.status(200).send('OK');
    }
    catch (err) {
        console.error('❌ Webhook error:', err);
        res.status(500).send('Error processing webhook');
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 App running on port ${PORT}`);
});
