// src/processScheduledCampaigns.ts
// Apply/expire scheduled campaigns using productVariantsBulkUpdate (Admin API 2024-10)

import { PrismaClient, CampaignStatus, PriceChangeSource, Prisma } from '@prisma/client';
import dotenv from 'dotenv';
import { GraphQLClient, gql } from 'graphql-request';
import { validateVariantsForCampaign } from './compliance';

dotenv.config();

const prisma = new PrismaClient();

const SHOPIFY_ADMIN_API = `https://${process.env.SHOP_DOMAIN}/admin/api/2024-10/graphql.json`;
const client = new GraphQLClient(SHOPIFY_ADMIN_API, {
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN || '',
    'Content-Type': 'application/json',
  },
});

function toGid(id: string): string {
  return id.startsWith('gid://') ? id : `gid://shopify/ProductVariant/${id}`;
}

async function applyCampaigns() {
  const now = new Date();

  const campaigns = await prisma.campaign.findMany({
    where: { status: CampaignStatus.DRAFT, startAt: { lte: now } },
    include: { campaignProducts: true },
  });

  for (const campaign of campaigns) {
    console.log(`🎯 Activating campaign ${campaign.id} - ${campaign.name}`);

    const discount = campaign.discountLogic as { type: 'percentage' | 'amount'; value: number } | null;
    if (!discount) {
      console.warn(`⚠️ Missing discount logic in campaign ${campaign.id}`);
      continue;
    }

    // Safety net: re-check compliance at activation time
    const variantIds = campaign.campaignProducts.map((cp) => cp.variantId);
    const violations = await validateVariantsForCampaign(variantIds, campaign.startAt);
    if (violations.length) {
      console.warn(`⛔ Skipping campaign ${campaign.id} due to compliance violations:`, violations);
      // Keep it in DRAFT
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: CampaignStatus.DRAFT },
      });
      continue;
    }

    for (const entry of campaign.campaignProducts) {
      const variantIdGid = toGid(entry.variantId);

      try {
        // 1) Fetch current price + product id
        const FETCH_VARIANT = gql`
          query ($id: ID!) {
            productVariant(id: $id) {
              id
              price
              compareAtPrice
              product { id }
            }
          }
        `;
        const fetchResp = (await client.request(FETCH_VARIANT, { id: variantIdGid })) as any;
        const variant = fetchResp?.productVariant;
        if (!variant) {
          console.warn(`⚠️ Variant ${variantIdGid} not found`);
          continue;
        }

        const productId: string = variant.product.id;
        const originalPrice = parseFloat(variant.price);
        const discountedPrice =
          discount.type === 'percentage'
            ? originalPrice * (1 - discount.value / 100)
            : originalPrice - discount.value;

        // Guard: never go negative
        const finalPrice = Math.max(0, discountedPrice);

        // 2) Bulk update (per product)
        const BULK_UPDATE = gql`
          mutation ($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) {
              product { id }
              userErrors { field message }
            }
          }
        `;

        const bulkResp = (await client.request(BULK_UPDATE, {
          productId,
          variants: [
            {
              id: variantIdGid,
              price: finalPrice.toFixed(2),
              compareAtPrice: originalPrice.toFixed(2), // show original as strikethrough
            },
          ],
        })) as any;

        const userErrors = bulkResp?.productVariantsBulkUpdate?.userErrors || [];
        if (userErrors.length) {
          console.error('❌ Shopify userErrors:', userErrors);
          continue;
        }

        // 3) Record price history (recording the pre-discount price as current snapshot)
        await prisma.priceHistory.create({
          data: {
            variantId: entry.variantId,
            price: new Prisma.Decimal(originalPrice),
            compareAtPrice: variant.compareAtPrice ? new Prisma.Decimal(variant.compareAtPrice) : null,
            changedBy: PriceChangeSource.APP,
            changedAt: now,
            campaignId: campaign.id,
          },
        });

        console.log(`✅ ${variantIdGid}: ${originalPrice} → ${finalPrice.toFixed(2)}`);
      } catch (err: any) {
        console.error(`❌ Failed variant ${variantIdGid}:`, err?.response?.data || err?.message || err);
      }
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: CampaignStatus.ACTIVE },
    });
    console.log(`📦 Campaign ${campaign.id} is now ACTIVE.`);
  }
}

async function expireCampaigns() {
  const now = new Date();

  const campaigns = await prisma.campaign.findMany({
    where: { status: CampaignStatus.ACTIVE, endAt: { lte: now } },
    include: { campaignProducts: true },
  });

  for (const campaign of campaigns) {
    console.log(`⏰ Expiring campaign ${campaign.id} - ${campaign.name}`);

    for (const entry of campaign.campaignProducts) {
      const variantIdGid = toGid(entry.variantId);

      try {
        // 1) Fetch product id
        const FETCH_VARIANT = gql`
          query ($id: ID!) {
            productVariant(id: $id) { product { id } }
          }
        `;
        const resp = (await client.request(FETCH_VARIANT, { id: variantIdGid })) as any;
        const productId: string | undefined = resp?.productVariant?.product?.id;
        if (!productId) {
          console.warn(`⚠️ Variant ${variantIdGid} not found, skipping`);
          continue;
        }

        // 2) Find the earliest history record for this campaign/variant (pre-discount baseline)
        const originalHistory = await prisma.priceHistory.findFirst({
          where: { campaignId: campaign.id, variantId: entry.variantId },
          orderBy: { changedAt: 'asc' },
        });
        if (!originalHistory) {
          console.warn(`⚠️ No original price history for ${variantIdGid}, skipping`);
          continue;
        }
        const revertPrice = originalHistory.price.toFixed(2);

        // 3) Revert via bulk update
        const BULK_UPDATE = gql`
          mutation ($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) {
              userErrors { field message }
            }
          }
        `;
        const upd = (await client.request(BULK_UPDATE, {
          productId,
          variants: [{ id: variantIdGid, price: revertPrice, compareAtPrice: null }],
        })) as any;

        const userErrors = upd?.productVariantsBulkUpdate?.userErrors || [];
        if (userErrors.length) {
          console.error('❌ Shopify revert errors:', userErrors);
          continue;
        }

        // 4) Record revert in history
        await prisma.priceHistory.create({
          data: {
            variantId: entry.variantId,
            price: new Prisma.Decimal(revertPrice),
            compareAtPrice: null,
            changedBy: PriceChangeSource.APP,
            changedAt: now,
            campaignId: campaign.id,
          },
        });

        console.log(`✅ Reverted ${variantIdGid} to ${revertPrice}`);
      } catch (err: any) {
        console.error(`❌ Failed to revert variant ${variantIdGid}:`, err?.response?.data || err?.message || err);
      }
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: CampaignStatus.FINISHED },
    });
    console.log(`📦 Campaign ${campaign.id} marked as FINISHED.`);
  }
}

// Runner
async function runAll() {
  await applyCampaigns();
  await expireCampaigns();
}

runAll()
  .catch((err) => console.error('❌ Processor crashed:', err))
  .finally(() => prisma.$disconnect());
