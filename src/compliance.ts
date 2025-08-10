// src/compliance.ts
import { PrismaClient } from '@prisma/client';
import { GraphQLClient, gql } from 'graphql-request';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const SHOPIFY_API = `https://${process.env.SHOP_DOMAIN}/admin/api/2024-10/graphql.json`;
const shopClient = new GraphQLClient(SHOPIFY_API, {
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN || '',
    'Content-Type': 'application/json',
  },
});

export type ComplianceViolation = {
  variantId: string;
  currentPrice: number | null;
  minPriceLast30: number | null;
  reason: 'NO_HISTORY' | 'COMPARE_ABOVE_30D_LOW';
  message: string;
};

/**
 * Validate variants against the 30-day rule for a campaign starting at `startAt`.
 * Returns an array of violations; empty = compliant.
 *
 * Rule: the "compare at price" (we use *current price at creation time*) must be
 * <= the lowest price in the 30 days before `startAt`.
 */
export async function validateVariantsForCampaign(
  variantIds: string[],
  startAt: Date
): Promise<ComplianceViolation[]> {
  if (variantIds.length === 0) return [];

  // 30-day window BEFORE the campaign start
  const windowEnd = startAt;
  const windowStart = new Date(windowEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 1) Get the lowest price per variant in the window
  const grouped = await prisma.priceHistory.groupBy({
    by: ['variantId'],
    where: {
      variantId: { in: variantIds },
      changedAt: { gte: windowStart, lt: windowEnd },
    },
    _min: { price: true },
  });
  const minMap = new Map(grouped.map(g => [g.variantId, g._min.price])); // Decimal | null

  // 2) Fetch current price for each variant from Shopify (this is what we’ll set as compareAtPrice)
  const VARIANT_Q = gql`query($id: ID!) { productVariant(id: $id) { id price } }`;
  const currentPriceMap = new Map<string, number | null>();
  for (const id of variantIds) {
    try {
      const resp = await shopClient.request(VARIANT_Q, { id }) as any;
      const price = resp?.productVariant?.price;
      currentPriceMap.set(id, price != null ? parseFloat(price) : null);
    } catch {
      currentPriceMap.set(id, null);
    }
  }

  // 3) Build violations
  const violations: ComplianceViolation[] = [];

  for (const id of variantIds) {
    const minDec = minMap.get(id) || null;
    const minNum = minDec ? Number(minDec.toString()) : null;
    const cur = currentPriceMap.get(id) ?? null;

    if (minNum == null) {
      violations.push({
        variantId: id,
        currentPrice: cur,
        minPriceLast30: null,
        reason: 'NO_HISTORY',
        message: `Variant has no price history in the 30 days before the campaign start.`,
      });
      continue;
    }

    if (cur == null) {
      violations.push({
        variantId: id,
        currentPrice: null,
        minPriceLast30: minNum,
        reason: 'COMPARE_ABOVE_30D_LOW',
        message: `Could not read current price from Shopify.`,
      });
      continue;
    }

    if (cur > minNum) {
      violations.push({
        variantId: id,
        currentPrice: cur,
        minPriceLast30: minNum,
        reason: 'COMPARE_ABOVE_30D_LOW',
        message: `Planned compare-at (${cur.toFixed(2)}) exceeds 30-day low (${minNum.toFixed(2)}).`,
      });
    }
  }

  return violations;
}
