import { PrismaClient, PriceChangeSource, Prisma } from '@prisma/client';
import { GraphQLClient, gql } from 'graphql-request';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

const shop = new GraphQLClient(
  `https://${process.env.SHOP_DOMAIN}/admin/api/2024-10/graphql.json`,
  { headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN! } }
);

async function seedVariant(variantGid: string) {
  // Fetch current price
  const { productVariant } = (await shop.request(
    gql`query ($id: ID!) { productVariant(id: $id) { price } }`,
    { id: variantGid }
  )) as any;

  const price = parseFloat(productVariant.price);
  // Back-date 31 days
  const changedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

  await prisma.priceHistory.create({
    data: {
      variantId: variantGid,
      price: new Prisma.Decimal(price),
      compareAtPrice: null,
      changedBy: PriceChangeSource.MERCHANT,
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
