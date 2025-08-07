"use strict";
// src/compliance.ts - Norwegian "førpris" compliance check: compare compareAtPrice to lowest price in last 30 days
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCampaign = validateCampaign;
const client_1 = require("@prisma/client");
const graphql_request_1 = require("graphql-request");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
// Shopify GraphQL client for fetching live variant price
const SHOPIFY_API = `https://${process.env.SHOP_DOMAIN}/admin/api/2024-10/graphql.json`;
const shopClient = new graphql_request_1.GraphQLClient(SHOPIFY_API, {
    headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN || '',
        'Content-Type': 'application/json',
    },
});
/**
 * Validate a campaign against Norwegian reference-price rule:
 *  compareAtPrice must equal lowest sale price in last 30 days.
 * Returns an array of error messages; empty = compliant.
 */
async function validateCampaign(campaign) {
    const errors = [];
    if (campaign.type !== 'SALE' || campaign.status !== client_1.CampaignStatus.DRAFT)
        return errors;
    const start = campaign.startAt;
    const windowStart = new Date(start.getTime() - 30 * 24 * 60 * 60 * 1000);
    // Fetch linked variants
    const products = await prisma.campaignProduct.findMany({ where: { campaignId: campaign.id } });
    for (const { variantId } of products) {
        try {
            // 1️⃣ Fetch planned compareAtPrice (the price before discount)
            const fetchQuery = (0, graphql_request_1.gql) `query ($id: ID!) {
        productVariant(id: $id) { price }
      }`;
            const fetchResp = (await shopClient.request(fetchQuery, { id: variantId }));
            const compareAtPrice = parseFloat(fetchResp.productVariant.price);
            // 2️⃣ Get history in last 30 days
            const history = await prisma.priceHistory.findMany({
                where: {
                    variantId,
                    changedAt: { gte: windowStart, lt: start }
                }
            });
            if (history.length === 0) {
                errors.push(`Variant ${variantId}: no price history in 30 days before start`);
                continue;
            }
            // 3️⃣ Compute lowest price
            let minPrice = history[0].price;
            for (const rec of history) {
                if (rec.price.lt(minPrice))
                    minPrice = rec.price;
            }
            // 4️⃣ Compare
            if (compareAtPrice !== minPrice.toNumber()) {
                errors.push(`Variant ${variantId}: compareAtPrice ${compareAtPrice} != lowest price ${minPrice.toString()} in last 30 days`);
            }
        }
        catch (err) {
            errors.push(`Variant ${variantId}: compliance check failed (${err instanceof Error ? err.message : String(err)})`);
        }
    }
    return errors;
}
