"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.get('/products', async (req, res) => {
    var _a, _b;
    const q = (_b = (_a = req.query.q) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : '';
    const limit = Math.min(parseInt(req.query.limit || '25', 10), 50);
    const cursor = req.query.cursor || null;
    try {
        const where = q
            ? {
                OR: [
                    { title: { contains: q, mode: client_1.Prisma.QueryMode.insensitive } },
                    { product: { title: { contains: q, mode: client_1.Prisma.QueryMode.insensitive } } },
                ],
            }
            : {};
        const rows = await prisma.variant.findMany(Object.assign(Object.assign({ where, include: { product: true }, take: limit + 1 }, (cursor ? { skip: 1, cursor: { id: cursor } } : {})), { orderBy: { id: 'asc' } }));
        const hasMore = rows.length > limit;
        const slice = hasMore ? rows.slice(0, limit) : rows;
        res.json({
            items: slice.map((v) => ({
                id: v.id,
                name: `${v.product.title} - ${v.title}`,
                price: v.price.toString(),
            })),
            nextCursor: hasMore ? slice[slice.length - 1].id : null,
        });
    }
    catch (err) {
        console.error('products search error:', err);
        res.status(500).json({ error: 'Search failed' });
    }
});
exports.default = router;
