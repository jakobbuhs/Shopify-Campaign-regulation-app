// src/campaigns/list/listCampaigns.ts
import { Router, Request, Response } from 'express';
import { PrismaClient, CampaignStatus } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /campaigns?status=ACTIVE|DRAFT|FINISHED&limit=50
 */
router.get('/campaigns', async (req: Request, res: Response) => {
  try {
    const statusParam = (req.query.status as string | undefined)?.toUpperCase();
    const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 200);

    const where =
      statusParam && (statusParam in CampaignStatus)
        ? { status: statusParam as CampaignStatus }
        : {};

    // sensible ordering: upcoming/active first by start date; finished last by end date desc
    const orderBy =
      (where as any).status === CampaignStatus.FINISHED
        ? [{ endAt: 'desc' as const }]
        : [{ startAt: 'asc' as const }];

    const items = await prisma.campaign.findMany({
      where,
      orderBy,
      take: limit,
      include: {
        campaignProducts: true,
      },
    });

    res.json({
      items: items.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        startAt: c.startAt,
        endAt: c.endAt,
        type: c.type,
        variantsCount: c.campaignProducts.length,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (err) {
    console.error('❌ Failed to list campaigns:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /campaigns/:id(\\d+) — keep your existing handler for details
router.get('/campaigns/:id(\\d+)', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        campaignProducts: true,
        priceHistories: {
          orderBy: { changedAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (err) {
    console.error('❌ Failed to get campaign by id:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
