"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/campaigns/list/listCampaigns.ts
const express_1 = require("express");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const router = (0, express_1.Router)();
/**
 * GET /campaigns?status=ACTIVE|DRAFT|FINISHED&limit=50
 */
router.get('/campaigns', async (req, res) => {
    var _a;
    try {
        const statusParam = (_a = req.query.status) === null || _a === void 0 ? void 0 : _a.toUpperCase();
        const limit = Math.min(parseInt(req.query.limit || '100', 10), 200);
        const where = statusParam && (statusParam in client_1.CampaignStatus)
            ? { status: statusParam }
            : {};
        // sensible ordering: upcoming/active first by start date; finished last by end date desc
        const orderBy = where.status === client_1.CampaignStatus.FINISHED
            ? [{ endAt: 'desc' }]
            : [{ startAt: 'asc' }];
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
    }
    catch (err) {
        console.error('❌ Failed to list campaigns:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /campaigns/:id(\\d+) — keep your existing handler for details
router.get('/campaigns/:id(\\d+)', async (req, res) => {
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
        if (!campaign)
            return res.status(404).json({ error: 'Campaign not found' });
        res.json(campaign);
    }
    catch (err) {
        console.error('❌ Failed to get campaign by id:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
