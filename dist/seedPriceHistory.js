"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const graphql_request_1 = require("graphql-request");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
const shop = new graphql_request_1.GraphQLClient(`https://${process.env.SHOP_DOMAIN}/admin/api/2024-10/graphql.json`, { headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN } });
async function seedVariant(variantGid) {
    // Fetch current price
    const { productVariant } = (await shop.request((0, graphql_request_1.gql) `query ($id: ID!) { productVariant(id: $id) { price } }`, { id: variantGid }));
    const price = parseFloat(productVariant.price);
    // Back-date 31 days
    const changedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await prisma.priceHistory.create({
        data: {
            variantId: variantGid,
            price: new client_1.Prisma.Decimal(price),
            compareAtPrice: null,
            changedBy: client_1.PriceChangeSource.MERCHANT,
            changedAt,
            campaignId: null,
        },
    });
    console.log(`Seeded ${variantGid} at ${changedAt.toISOString()} for price ${price}`);
}
async function run() {
    const variants = [
        'gid://shopify/ProductVariant/45400551719111',
        // add more if needed
    ];
    for (const v of variants) {
        await seedVariant(v);
    }
    await prisma.$disconnect();
}
run();
