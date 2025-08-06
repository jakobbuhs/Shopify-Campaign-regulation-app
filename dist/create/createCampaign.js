"use strict";
// createCampaign.ts - POST /campaigns/create
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
router.post('/campaigns/create', async (req, res) => {
    try {
        const { name, type, startAt, endAt, variantIds, discountLogic } = req.body;
        if (!name || !type || !startAt || !endAt || !variantIds || !discountLogic) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const campaign = await prisma.campaign.create({
            data: {
                name,
                type: type,
                startAt: new Date(startAt),
                endAt: new Date(endAt),
                discountLogic,
                status: client_1.CampaignStatus.DRAFT,
            },
        });
        // Log variant IDs for now – these would be linked in a future step
        console.log(`📦 Campaign created with ID ${campaign.id} for variants:`, variantIds);
        res.status(201).json({ message: 'Campaign created', campaign });
    }
    catch (error) {
        console.error('❌ Failed to create campaign:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
