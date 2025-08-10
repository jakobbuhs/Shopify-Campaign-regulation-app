import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/products', async (req: Request, res: Response) => {
  const q = (req.query.q as string)?.trim() ?? '';
  const limit = Math.min(parseInt((req.query.limit as string) || '25', 10), 50);
  const cursor = (req.query.cursor as string) || null;

  try {
    const where: Prisma.VariantWhereInput = q
      ? {
          OR: [
            { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { product: { title: { contains: q, mode: Prisma.QueryMode.insensitive } } },
          ],
        }
      : {};

    const rows = await prisma.variant.findMany({
      where,
      include: { product: true },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;

    res.json({
      items: slice.map((v) => ({
        id: v.id,
        name: `${v.product!.title} - ${v.title}`,
        price: v.price.toString(),
      })),
      nextCursor: hasMore ? slice[slice.length - 1].id : null,
    });
  } catch (err) {
    console.error('products search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
