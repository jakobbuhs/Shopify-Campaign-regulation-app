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

    // Save each variantId as a CampaignProduct entry
    await prisma.$transaction(
      variantIds.map((variantId: string) =>
        prisma.campaignProduct.create({
          data: {
            campaignId: campaign.id,
            variantId,
          },
        })
      )
    );

    console.log(`✅ Linked ${variantIds.length} variants to campaign ${campaign.id}`);

    res.status(201).json({ message: 'Campaign created', campaign });
  } catch (error) {
    console.error('❌ Failed to create campaign:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
