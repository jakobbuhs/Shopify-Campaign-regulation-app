// createCampaign.ts - POST /campaigns/create

import express, { Request, Response } from 'express';
import { PrismaClient, CampaignType, CampaignStatus } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const prisma = new PrismaClient();

router.post('/campaigns/create', async (req: Request, res: Response) => {
  try {
    const { name, type, startAt, endAt, variantIds, discountLogic } = req.body;

    if (!name || !type || !startAt || !endAt || !variantIds || !discountLogic) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const campaign = await prisma.campaign.create({
      data: {
        name,
        type: type as CampaignType,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        discountLogic,
        status: CampaignStatus.DRAFT,
      },
    });

    // Log variant IDs for now – these would be linked in a future step
    console.log(`📦 Campaign created with ID ${campaign.id} for variants:`, variantIds);

    res.status(201).json({ message: 'Campaign created', campaign });
  } catch (error) {
    console.error('❌ Failed to create campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
