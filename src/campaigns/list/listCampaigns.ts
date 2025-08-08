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
router.get('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const campaign = await prisma.campaign.findUnique({
      where: { id },
    });
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const campaignProducts = await prisma.campaignProduct.findMany({
      where: { campaignId: id },
    });
    const priceHistory = await prisma.priceHistory.findMany({
      where: { campaignId: id },
      orderBy: { changedAt: 'asc' },
    });

    res.json({
      ...campaign,
      campaignProducts,
      priceHistory,
    });
  } catch (error) {
    console.error(`❌ Failed to get campaign ${req.params.id}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
