// src/campaigns/list/listCampaigns.ts - List and retrieve campaigns with details
import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /campaigns - list all campaigns
router.get('/campaigns', async (_req: Request, res: Response) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { startAt: 'desc' },
    });
    res.json(campaigns);
  } catch (error) {
    console.error('❌ Failed to list campaigns:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /campaigns/:id - get a single campaign with products and price history
// GET /campaigns/:id
router.get('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = Number(idParam);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: `Invalid campaign id: ${idParam}` });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        campaignProducts: true,
        // Ensure this matches your Prisma model: it's "priceHistories", not "priceHistory"
        priceHistories: {
          orderBy: { changedAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    return res.json(campaign);
  } catch (err) {
    console.error('❌ Failed to get campaign by id:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


export default router;
