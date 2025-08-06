"use strict";
// registerWebhook.ts - Register PRODUCTS_UPDATE webhook via Shopify GraphQL
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_request_1 = require("graphql-request");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const SHOP_DOMAIN = process.env.SHOP_DOMAIN;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const APP_URL = process.env.APP_URL;
if (!SHOP_DOMAIN || !ACCESS_TOKEN || !APP_URL) {
    console.error('❌ Missing environment variables.');
    console.log('SHOP_DOMAIN:', SHOP_DOMAIN);
    console.log('SHOPIFY_ACCESS_TOKEN:', ACCESS_TOKEN);
    console.log('APP_URL:', APP_URL);
    process.exit(1);
}
const endpoint = `https://${SHOP_DOMAIN}/admin/api/2023-10/graphql.json`;
const mutation = (0, graphql_request_1.gql) `
  mutation webhookSubscriptionCreate(
    $topic: WebhookSubscriptionTopic!
    $webhookSubscription: WebhookSubscriptionInput!
  ) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      userErrors {
        field
        message
      }
      webhookSubscription {
        id
        endpoint
      }
    }
  }
`;
const variables = {
    topic: 'PRODUCTS_UPDATE',
    webhookSubscription: {
        callbackUrl: `${APP_URL}/webhooks/products/update`,
        format: 'JSON',
    },
};
async function registerWebhook() {
    try {
        const data = await (0, graphql_request_1.request)(endpoint, mutation, variables, {
            'X-Shopify-Access-Token': ACCESS_TOKEN || '',
            'Content-Type': 'application/json',
        });
        const { userErrors, webhookSubscription } = data.webhookSubscriptionCreate;
        if (userErrors.length > 0) {
            console.error('❌ Shopify webhook registration errors:', userErrors);
        }
        else {
            console.log('✅ Webhook registered:', webhookSubscription);
        }
    }
    catch (err) {
        console.error('❌ Error registering webhook:', err);
    }
}
registerWebhook();
