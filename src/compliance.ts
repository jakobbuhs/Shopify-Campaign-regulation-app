// src/compliance.ts - Norwegian "førpris" compliance checks without external libs
import { PrismaClient, Campaign, CampaignStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Validate a campaign against Norwegian reference-price rules.
 * Returns an array of error messages. Empty array means compliant.
 */
export async function validateCampaign(campaign: Campaign): Promise<string[]> {
  const errors: string[] = [];

  // Only enforce for SALE campaigns
  if (campaign.type !== 'SALE') return errors;

  // 30 days before startAt
  const start = campaign.startAt;
  const windowStart = new Date(start.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Fetch linked variants
  const products = await prisma.campaignProduct.findMany({ where: { campaignId: campaign.id } });

  for (const { variantId } of products) {
    // 1️⃣ History in window
    const history = await prisma.priceHistory.findMany({
      where: {
        variantId,
        changedAt: { gte: windowStart, lt: start }
      },
      orderBy: { changedAt: 'asc' }
    });
    if (history.length === 0) {
      errors.push(`No price history for variant ${variantId} in the 30 days before start.`);
      continue;
    }

    // 2️⃣ Compute lowest price (førpris)
    let minPrice = history[0].price;
    for (const rec of history) {
      if (rec.price.lt(minPrice)) minPrice = rec.price;
    }
    const reference = minPrice;

    // 3️⃣ Check discount logic percentage matches reference price
    const logic = campaign.discountLogic as { type: string; value: number };
    if (!logic || logic.type !== 'percentage' || logic.value == null) {
      errors.push(`Missing or invalid discount logic for variant ${variantId}.`);
      continue;
    }
    // The campaign final price isn't stored in campaign; fetch last PriceHistory for this campaign & variant
    const activationRecord = await prisma.priceHistory.findFirst({
      where: { campaignId: campaign.id, variantId },
      orderBy: { changedAt: 'desc' }
    });
    if (!activationRecord) {
      errors.push(`No activation history for variant ${variantId}.`);
      continue;
    }
    const campaignPrice = activationRecord.price;

    // Calculate expected discount percent
    const expectedPct = Math.round((reference.toNumber() - campaignPrice.toNumber()) / reference.toNumber() * 100);
    if (expectedPct !== logic.value) {
      errors.push(
        `Variant ${variantId}: expected discount ${expectedPct}% off reference ${reference.toString()}, but campaign logic is ${logic.value}%.`
      );
    }
  }

  return errors;
}
