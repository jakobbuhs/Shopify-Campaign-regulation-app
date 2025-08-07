"use strict";
// processScheduledCampaigns.ts - Apply scheduled campaign discounts using productVariantsBulkUpdate (2024-10 compatible)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
const graphql_request_1 = require("graphql-request");
const compliance_1 = require("./compliance");
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
// Use latest Admin API (2024-10+) – bulk mutation is available
const SHOPIFY_ADMIN_API = `https://${process.env.SHOP_DOMAIN}/admin/api/2024-10/graphql.json`;
const client = new graphql_request_1.GraphQLClient(SHOPIFY_ADMIN_API, {
    headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN || '',
        'Content-Type': 'application/json',
    },
});
function toGid(id) {
    return id.startsWith('gid://') ? id : `gid://shopify/ProductVariant/${id}`;
}
async function applyCampaigns() {
    const now = new Date();
    const campaigns = await prisma.campaign.findMany({
        where: { status: client_1.CampaignStatus.DRAFT, startAt: { lte: now } },
        include: { campaignProducts: true },
    });
    for (const campaign of campaigns) {
        console.log(`🎯 Activating campaign ${campaign.id} - ${campaign.name}`);
        const complianceErrors = await (0, compliance_1.validateCampaign)(campaign);
        if (complianceErrors.length) {
            console.error(`❌ Compliance failed for campaign ${campaign.id}:`, complianceErrors);
            continue; // skip activation
        }
        const discount = campaign.discountLogic;
        if (!discount) {
            console.warn(`⚠️  Missing discount logic in campaign ${campaign.id}`);
            continue;
        }
        const errors = await (0, compliance_1.validateCampaign)(campaign);
        if (errors.length) {
            console.error(`❌ Compliance failed for campaign ${campaign.id}:`, errors);
            continue;
        }
        for (const entry of campaign.campaignProducts) {
            const variantIdGid = toGid(entry.variantId);
            try {
                // 1️⃣ Fetch variant price **and productId**
                const fetchQuery = (0, graphql_request_1.gql) `query ($id: ID!) {
          productVariant(id: $id) { id price compareAtPrice product { id } }
        }`;
                const fetchResp = (await client.request(fetchQuery, { id: variantIdGid }));
                const variant = fetchResp.productVariant;
                if (!variant) {
                    console.warn(`⚠️  Variant ${variantIdGid} not found`);
                    continue;
                }
                const originalPrice = parseFloat(variant.price);
                const discountedPrice = discount.type === 'percentage'
                    ? originalPrice * (1 - discount.value / 100)
                    : originalPrice - discount.value;
                // Inside for(const campaign of campaigns) { … }
                // 2️⃣ Bulk update (works in 2024‑10+)
                const bulkMutation = (0, graphql_request_1.gql) `
  mutation ($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      product { id }
      userErrors { field message }
    }
  }
`;
                const bulkResp = (await client.request(bulkMutation, {
                    productId: variant.product.id,
                    variants: [{
                            id: variantIdGid,
                            price: discountedPrice.toFixed(2),
                            compareAtPrice: originalPrice.toFixed(2) // show original as strikethrough price
                        }],
                }));
                const bulkErrors = bulkResp.productVariantsBulkUpdate.userErrors;
                if (bulkErrors.length) {
                    console.error('❌ Shopify userErrors:', bulkErrors);
                    continue;
                }
                // 3️⃣ Record price history
                await prisma.priceHistory.create({
                    data: {
                        variantId: entry.variantId,
                        price: new client_1.Prisma.Decimal(originalPrice),
                        compareAtPrice: variant.compareAtPrice ? new client_1.Prisma.Decimal(variant.compareAtPrice) : null,
                        changedBy: client_1.PriceChangeSource.APP,
                        changedAt: now,
                        campaignId: campaign.id,
                    },
                });
                console.log(`✅ ${variantIdGid}: ${originalPrice} → ${discountedPrice.toFixed(2)}`);
            }
            catch (err) {
                console.error(`❌ Failed variant ${variantIdGid}:`, err);
            }
        }
        await prisma.campaign.update({ where: { id: campaign.id }, data: { status: client_1.CampaignStatus.ACTIVE } });
        console.log(`📦 Campaign ${campaign.id} is now ACTIVE.`);
    }
}
applyCampaigns()
    .catch(err => console.error('❌ Processor crashed:', err))
    .finally(() => prisma.$disconnect());
async function expireCampaigns() {
    const now = new Date();
    // 1️⃣ find all ACTIVE campaigns that have ended
    const campaigns = await prisma.campaign.findMany({
        where: {
            status: client_1.CampaignStatus.ACTIVE,
            endAt: { lte: now },
        },
        include: { campaignProducts: true },
    });
    for (const campaign of campaigns) {
        console.log(`⏰ Expiring campaign ${campaign.id} - ${campaign.name}`);
        for (const entry of campaign.campaignProducts) {
            const variantIdGid = toGid(entry.variantId);
            try {
                // 2️⃣ fetch product.id so we can bulk update
                const fetchQuery = (0, graphql_request_1.gql) `
            query ($id: ID!) {
              productVariant(id: $id) {
                product { id }
              }
            }
          `;
                const { productVariant } = (await client.request(fetchQuery, { id: variantIdGid }));
                if (!productVariant) {
                    console.warn(`⚠️ Variant ${variantIdGid} not found, skipping`);
                    continue;
                }
                const productId = productVariant.product.id;
                // 3️⃣ get the *first* history record for this campaign/variant (the pre-discount price)
                const originalHistory = await prisma.priceHistory.findFirst({
                    where: {
                        campaignId: campaign.id,
                        variantId: entry.variantId,
                    },
                    orderBy: { changedAt: 'asc' },
                });
                if (!originalHistory) {
                    console.warn(`⚠️ No original price history for ${variantIdGid}, skipping`);
                    continue;
                }
                const revertPrice = originalHistory.price.toFixed(2);
                // 4️⃣ send the revert mutation
                const revertMutation = (0, graphql_request_1.gql) `
            mutation ($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                userErrors { field message }
              }
            }
          `;
                const { productVariantsBulkUpdate } = (await client.request(revertMutation, {
                    productId,
                    variants: [
                        {
                            id: variantIdGid,
                            price: revertPrice,
                            compareAtPrice: null // clear compare-at
                        },
                    ],
                }));
                if (productVariantsBulkUpdate.userErrors.length) {
                    console.error('❌ Shopify revert errors:', productVariantsBulkUpdate.userErrors);
                    continue;
                }
                // 5️⃣ record the revert in PriceHistory
                await prisma.priceHistory.create({
                    data: {
                        variantId: entry.variantId,
                        price: new client_1.Prisma.Decimal(revertPrice),
                        compareAtPrice: null,
                        changedBy: client_1.PriceChangeSource.APP,
                        changedAt: now,
                        campaignId: campaign.id,
                    },
                });
                console.log(`✅ Reverted ${variantIdGid} to ${revertPrice}`);
            }
            catch (err) {
                console.error(`❌ Failed to revert variant ${variantIdGid}:`, err);
            }
        }
        // 6️⃣ mark the campaign as finished
        await prisma.campaign.update({
            where: { id: campaign.id },
            data: { status: client_1.CampaignStatus.FINISHED },
        });
        console.log(`📦 Campaign ${campaign.id} marked as FINISHED.`);
    }
}
// ➌ Finally, run both passes in sequence
async function runAll() {
    await applyCampaigns();
    await expireCampaigns();
}
runAll()
    .catch((err) => console.error('❌ Processor crashed:', err))
    .finally(() => prisma.$disconnect());
