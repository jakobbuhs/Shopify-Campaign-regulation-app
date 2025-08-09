"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/campaigns/create/createCampaign.ts
const express_1 = require("express");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const router = (0, express_1.Router)();
/**
 * POST /campaigns/create
 * body: { name, type, startAt, endAt, variantIds: string[], discountLogic }
 */
router.post('/campaigns/create', async (req, res) => {
    var _a;
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
                type: (_a = type) !== null && _a !== void 0 ? _a : 'SALE',
                startAt: start,
                endAt: end,
                status: client_1.CampaignStatus.DRAFT,
                discountLogic,
                campaignProducts: {
                    create: variantIds.map((id) => ({ variantId: id })),
                },
            },
        });
        return res.json({ message: 'Campaign created', campaign });
    }
    catch (err) {
        console.error('createCampaign error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
