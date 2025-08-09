// src/campaigns/create/createCampaign.ts
import { Router, Request, Response } from 'express';
import { PrismaClient, CampaignType, CampaignStatus } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

/**
 * POST /campaigns/create
 * body: { name, type, startAt, endAt, variantIds: string[], discountLogic }
 */
router.post('/campaigns/create', async (req: Request, res: Response) => {
  try {
    const { name, type, startAt, endAt, variantIds, discountLogic } = req.body;

    if (!name || !startAt || !endAt || !Array.isArray(variantIds) || !discountLogic) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ error: 'Invalid start/end dates' });
    }

    const campaign = await prisma.campaign.create({
      data: {
        name,
        type: (type as CampaignType) ?? 'SALE',
        startAt: start,
        endAt: end,
        status: CampaignStatus.DRAFT,
        discountLogic,
        campaignProducts: {
          create: variantIds.map((id: string) => ({ variantId: id })),
        },
      },
    });

    return res.json({ message: 'Campaign created', campaign });
  } catch (err) {
    console.error('createCampaign error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
