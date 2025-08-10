// src/campaigns/create/createCampaign.ts
import { Router, Request, Response } from 'express';
import { PrismaClient, CampaignStatus } from '@prisma/client';
import { validateVariantsForCampaign } from '../../compliance';

const router = Router();
const prisma = new PrismaClient();

router.post('/campaigns/create', async (req: Request, res: Response) => {
  try {
    const {
      name, type, startAt, endAt, variantIds, discountLogic,
      override30d, overrideReason,
    } = req.body as {
      name: string;
      type: 'SALE';
      startAt: string;
      endAt: string;
      variantIds: string[];
      discountLogic: { type: 'percentage' | 'amount'; value: number };
      override30d?: boolean;
      overrideReason?: string;
    };

    if (!name || !startAt || !endAt || !Array.isArray(variantIds) || variantIds.length === 0) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const startDate = new Date(startAt);
    const endDate = new Date(endAt);

    // Run compliance check
    const violations = await validateVariantsForCampaign(variantIds, startDate);

    // Only these two reasons are overridable
    const isOverridableReason = (r: string) =>
      r === 'NO_HISTORY' || r === 'COMPARE_ABOVE_30D_LOW';

    // If override30d=true, filter out the overridable ones
    const nonOverridable = violations.filter(v => !(override30d && isOverridableReason(v.reason)));

    if (nonOverridable.length > 0) {
      return res.status(422).json({
        error: 'COMPLIANCE_FAILED',
        message: 'One or more variants violate non-overridable rules.',
        violations: nonOverridable,
      });
    }

    const overridden = violations.length > 0 && nonOverridable.length === 0 && !!override30d;

    const campaign = await prisma.campaign.create({
      data: {
        name,
        type,
        startAt: startDate,
        endAt: endDate,
        discountLogic,
        status: CampaignStatus.DRAFT,
        campaignProducts: {
          createMany: { data: variantIds.map(id => ({ variantId: id })) },
        },
      },
    });

    // Simple audit log to server logs (you can persist later in DB)
    if (overridden) {
      console.warn(`[COMPLIANCE OVERRIDE] campaign ${campaign.id}`, {
        overrideReason: overrideReason || '(none provided)',
        ignoredViolations: violations,
      });
    }

    return res.json({
      message: overridden ? 'Campaign created (30-day rule overridden)' : 'Campaign created',
      campaign,
      compliance: { overridden, ignored: overridden ? violations : [] },
    });
  } catch (err) {
    console.error('❌ Create campaign error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
