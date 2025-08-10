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
router.get('/campaigns/:id(\\d+)/details', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: `Invalid campaign id: ${req.params.id}` });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { campaignProducts: true },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const variantIds = campaign.campaignProducts.map((cp) => cp.variantId);
    if (variantIds.length === 0) {
      return res.json({
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          type: campaign.type,
          startAt: campaign.startAt,
          endAt: campaign.endAt,
        },
        items: [],
      });
    }

    // Fetch variant info (title, price, product title)
    const variants = await prisma.variant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true },
      orderBy: { id: 'asc' },
    });

    // 30-day window BEFORE campaign start
    const windowEnd = campaign.startAt;
    const windowStart = new Date(windowEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Compute lowest price per variant in that window using groupBy
    const grouped = await prisma.priceHistory.groupBy({
      by: ['variantId'],
      where: {
        variantId: { in: variantIds },
        changedAt: { gte: windowStart, lt: windowEnd },
      },
      _min: { price: true },
    });

    const minMap = new Map(grouped.map((g) => [g.variantId, g._min.price])); // Decimal | null

    const items = variants.map((v) => {
      const lowest = minMap.get(v.id) || null;
      return {
        id: v.id,
        name: `${v.product?.title ?? 'Product'} - ${v.title}`,
        currentPrice: v.price.toString(),
        lowest30BeforeStart: lowest ? lowest.toString() : null,
        hasHistory: !!lowest,
      };
    });

    return res.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        type: campaign.type,
        startAt: campaign.startAt,
        endAt: campaign.endAt,
      },
      items,
    });
  } catch (err) {
    console.error('❌ Failed to get campaign details:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
