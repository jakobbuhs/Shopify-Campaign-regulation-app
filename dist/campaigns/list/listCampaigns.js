"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/campaigns/list/listCampaigns.ts - List and retrieve campaigns with details
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
// GET /campaigns - list all campaigns
router.get('/campaigns', async (_req, res) => {
    try {
        const campaigns = await prisma.campaign.findMany({
            orderBy: { startAt: 'desc' },
        });
        res.json(campaigns);
    }
    catch (error) {
        console.error('❌ Failed to list campaigns:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /campaigns/:id - get a single campaign with products and price history
router.get('/campaigns/:id', async (req, res) => {
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
        res.json(Object.assign(Object.assign({}, campaign), { campaignProducts,
            priceHistory }));
    }
    catch (error) {
        console.error(`❌ Failed to get campaign ${req.params.id}:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
