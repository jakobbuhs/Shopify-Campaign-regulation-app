import express from 'express';
import { PrismaClient } from '@prisma/client';
import { GraphQLClient, gql } from 'graphql-request';
import dotenv from 'dotenv';
import { getClientForShop } from '../lib/shopClient';
dotenv.config();
const router = express.Router();
const prisma = new PrismaClient();

/**
 * Helper: get a GraphQL client for the single shop you’re using today.
 * If you’ve enabled multi-shop OAuth, resolve the domain dynamically from req (or Shop table).
 */
function getClient() {
  const domain = process.env.SHOP_DOMAIN!;
  const token = process.env.SHOPIFY_ACCESS_TOKEN!; // or fetch from Shop table
  return new GraphQLClient(`https://${domain}/admin/api/2024-10/graphql.json`, {
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
  });
}

const PRODUCT_QUERY = gql`
  query ($id: ID!) {
    product(id: $id) {
      id
      variants(first: 250) {
        nodes {
          id
          price
          compareAtPrice
        }
      }
    }
  }
`;

/**
 * GET /compliance/audit?windowDays=30&onlyOnSale=true
 * Returns { checked, violations: [...] }
 */
router.get('/compliance/audit', async (req, res) => {
  const windowDays = Number(req.query.windowDays ?? 30);
  const onlyOnSale = String(req.query.onlyOnSale ?? 'true') === 'true';
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const shopDomain = typeof req.query.shop === 'string' ? req.query.shop : undefined;
  const client = await getClientForShop(shopDomain);

  try {
    // Pull distinct productIds you have in your Variant table to batch queries
    const productIds = await prisma.variant.findMany({
      distinct: ['productId'],
      select: { productId: true },
      take: 5000, // safety cap
    });

    const client = getClient();
    const violations: Array<{
      variantId: string;
      currentPrice: number;
      compareAtPrice: number;
      minLast30: string; // decimal as string
      reason: string;
    }> = [];
    let checked = 0;

    for (const { productId } of productIds) {
      const gid = productId.startsWith('gid://') ? productId : `gid://shopify/Product/${productId}`;
      const resp = (await client.request(PRODUCT_QUERY, { id: gid })) as any;
      const nodes: any[] = resp?.product?.variants?.nodes ?? [];

      for (const v of nodes) {
        checked++;
        const variantIdGid: string = v.id;
        const variantId = variantIdGid.split('/').pop()!;

        const price = parseFloat(v.price);
        const cap = v.compareAtPrice == null ? null : parseFloat(v.compareAtPrice);

        // Only audit items actively marketed as on sale (compare-at > price)
        if (onlyOnSale && !(cap != null && cap > price)) continue;

        const history = await prisma.priceHistory.findMany({
          where: {
            variantId,
            changedAt: { gte: windowStart, lt: now },
          },
          select: { price: true },
        });

        if (!history.length) {
          violations.push({
            variantId: variantIdGid,
            currentPrice: price,
            compareAtPrice: cap ?? NaN,
            minLast30: 'N/A',
            reason: 'No price history in the last 30 days',
          });
          continue;
        }

        // compute minimum (Decimal -> string; compare as number safely)
        let minStr = history[0].price.toString();
        for (const h of history) {
          if (Number(h.price.toString()) < Number(minStr)) minStr = h.price.toString();
        }

        // Rule: compare-at price must not exceed the lowest price in last 30 days.
        // (If you want strict equality to the 30-day low, change condition accordingly.)
        if (cap != null && cap > Number(minStr)) {
          violations.push({
            variantId: variantIdGid,
            currentPrice: price,
            compareAtPrice: cap,
            minLast30: minStr,
            reason: `compareAtPrice (${cap}) is higher than 30-day low (${minStr})`,
          });
        }
      }
    }

    res.json({ checked, violations, windowDays });
  } catch (err) {
    console.error('Audit failed:', err);
    res.status(500).json({ error: 'Audit failed' });
  }
});

export default router;
