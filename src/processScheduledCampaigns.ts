// processScheduledCampaigns.ts - Apply scheduled campaign discounts

import { PrismaClient, CampaignStatus, PriceChangeSource, Prisma } from '@prisma/client';
import dotenv from 'dotenv';
import { GraphQLClient, gql } from 'graphql-request';

dotenv.config();

const prisma = new PrismaClient();

const SHOPIFY_ADMIN_API = `https://${process.env.SHOP_DOMAIN}/admin/api/2024-04/graphql.json`;
const client = new GraphQLClient(SHOPIFY_ADMIN_API, {
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN || '',
    'Content-Type': 'application/json',
  },
});

async function applyCampaigns() {
  const now = new Date();

  const campaigns = await prisma.campaign.findMany({
    where: {
      status: CampaignStatus.DRAFT,
      startAt: { lte: now },
    },
    include: {
      campaignProducts: true,
    },
  });

  for (const campaign of campaigns) {
    console.log(`🎯 Activating campaign ${campaign.id} - ${campaign.name}`);

    const discount = campaign.discountLogic as { type: string; value: number };
    if (!discount || !discount.type || discount.value == null) {
        console.warn(`⚠️ Missing discount logic in campaign ${campaign.id}`);
        continue;
      }
      


    for (const entry of campaign.campaignProducts) {
      const variantId = entry.variantId;

      try {
        // Fetch original variant price (GraphQL call)
        const fetchQuery = gql`
          query fetchVariant($id: ID!) {
            productVariant(id: $id) {
              id
              price
              compareAtPrice
            }
          }
        `;

        const variantData = await client.request(fetchQuery, { id: variantId });
        const variant = (variantData as any).productVariant;


        const originalPrice = parseFloat(variant.price);
        const discountedPrice = (discount.type === 'percentage')
          ? originalPrice * (1 - discount.value / 100)
          : originalPrice - discount.value;

        // Update Shopify variant price (GraphQL mutation)
        const mutation = gql`
          mutation updateVariant($input: ProductVariantInput!) {
            productVariantUpdate(input: $input) {
              productVariant {
                id
                price
              }
              userErrors { field message }
            }
          }
        `;

        await client.request(mutation, {
          input: {
            id: variantId,
            price: discountedPrice.toFixed(2),
          },
        });

        await prisma.priceHistory.create({
          data: {
            variantId,
            price: new Prisma.Decimal(originalPrice),
            compareAtPrice: variant.compareAtPrice ? new Prisma.Decimal(variant.compareAtPrice) : null,
            changedBy: PriceChangeSource.APP,
            changedAt: now,
            campaignId: campaign.id,
          },
        });

        console.log(`✅ Applied discount to ${variantId}: ${originalPrice} → ${discountedPrice.toFixed(2)}`);
      } catch (err) {
        console.error(`❌ Failed to update variant ${entry.variantId}:`, err);
      }
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: CampaignStatus.ACTIVE },
    });

    console.log(`📦 Campaign ${campaign.id} marked as ACTIVE.`);
  }
}

applyCampaigns()
  .catch((err) => {
    console.error('❌ Campaign processor failed:', err);
  })
  .finally(() => {
    prisma.$disconnect();
  });
