// registerWebhook.ts - Register PRODUCTS_UPDATE webhook via Shopify GraphQL

import { request, gql, RequestDocument, Variables } from 'graphql-request';
import dotenv from 'dotenv';
dotenv.config();

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

const mutation: RequestDocument = gql`
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

const variables: Variables = {
  topic: 'PRODUCTS_UPDATE',
  webhookSubscription: {
    callbackUrl: `${APP_URL}/webhooks/products/update`,
    format: 'JSON',
  },
};

async function registerWebhook() {
  try {
    const data = await request(
      endpoint,
      mutation,
      variables,
      {
        'X-Shopify-Access-Token': ACCESS_TOKEN || '',
        'Content-Type': 'application/json',
      }
    ) as {
      webhookSubscriptionCreate: {
        userErrors: { field: string[]; message: string }[];
        webhookSubscription: { id: string; endpoint: string };
      };
    };

    const { userErrors, webhookSubscription } = data.webhookSubscriptionCreate;

    if (userErrors.length > 0) {
      console.error('❌ Shopify webhook registration errors:', userErrors);
    } else {
      console.log('✅ Webhook registered:', webhookSubscription);
    }
  } catch (err) {
    console.error('❌ Error registering webhook:', err);
  }
}

registerWebhook();
