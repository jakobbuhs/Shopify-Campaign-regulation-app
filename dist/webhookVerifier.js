"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyShopifyWebhook = verifyShopifyWebhook;
const crypto_1 = __importDefault(require("crypto"));
function verifyShopifyWebhook(secret) {
    return (req, _res, next) => {
        const hmacHeader = req.headers['x-shopify-hmac-sha256'];
        const generatedHash = crypto_1.default
            .createHmac('sha256', secret)
            .update(req.body)
            .digest('base64');
        if (generatedHash !== hmacHeader) {
            console.error('❌ Webhook HMAC validation failed');
            return _res.status(401).send('Unauthorized');
        }
        next();
    };
}
