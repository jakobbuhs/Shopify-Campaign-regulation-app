import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { GraphQLClient, gql } from 'graphql-request';

const prisma = new PrismaClient();

const API = `https://${process.env.SHOP_DOMAIN}/admin/api/2024-10/graphql.json`;
const client = new GraphQLClient(API, {
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN || '',
    'Content-Type': 'application/json',
  },
});

const PRODUCTS_QUERY = gql`
  query Products($cursor: String) {
    products(first: 100, after: $cursor) {
      edges {
        cursor
        node {
          id
          title
          vendor
          handle
        }
      }
      pageInfo { hasNextPage }
    }
  }
`;

const VARIANTS_QUERY = gql`
  query ProductVariants($productId: ID!, $cursor: String) {
    product(id: $productId) {
      variants(first: 100, after: $cursor) {
        edges {
          cursor
          node {
            id
            title
            sku
            price
          }
        }
        pageInfo { hasNextPage }
      }
    }
  }
`;

async function fetchAllVariants(productId: string) {
  let cursor: string | null = null;
  let edges: any[] = [];
  let hasNext = true;

  while (hasNext) {
    const resp = (await client.request(VARIANTS_QUERY, { productId, cursor })) as any;
    const vConn = resp.product.variants;
    edges = edges.concat(vConn.edges);
    hasNext = vConn.pageInfo.hasNextPage;
    if (hasNext && vConn.edges.length) {
      cursor = vConn.edges[vConn.edges.length - 1].cursor;
    } else {
      cursor = null;
    }
  }
  return edges;
}

async function syncAllProducts() {
  let productCursor: string | null = null;
  let totalProducts = 0;
  let totalVariants = 0;

  try {
    while (true) {
      const resp = (await client.request(PRODUCTS_QUERY, { cursor: productCursor })) as any;
      const conn = resp.products;
      const edges = conn.edges as any[];

      if (!edges.length) break;

      for (const edge of edges) {
        const p = edge.node;

        // Upsert product
        await prisma.product.upsert({
          where: { id: p.id },
          update: { title: p.title, vendor: p.vendor ?? null, handle: p.handle ?? null },
          create: { id: p.id, title: p.title, vendor: p.vendor ?? null, handle: p.handle ?? null },
        });
        totalProducts++;

        // Fetch ALL variants for this product (handles >100)
        const allVariantEdges = await fetchAllVariants(p.id);
        const seenVariantIds: string[] = [];

        for (const vEdge of allVariantEdges) {
          const v = vEdge.node;
          seenVariantIds.push(v.id);

          await prisma.variant.upsert({
            where: { id: v.id },
            update: {
              title: v.title,
              sku: v.sku ?? null,
              price: new Prisma.Decimal(v.price ?? '0'),
              productId: p.id,
            },
            create: {
              id: v.id,
              title: v.title,
              sku: v.sku ?? null,
              price: new Prisma.Decimal(v.price ?? '0'),
              productId: p.id,
            },
          });
          totalVariants++;
        }

        // Optional cleanup of orphans:
        // await prisma.variant.deleteMany({ where: { productId: p.id, id: { notIn: seenVariantIds } } });
      }

      productCursor = edges[edges.length - 1].cursor;
      if (!conn.pageInfo.hasNextPage) break;
    }

    console.log(`✅ Sync complete. Products: ${totalProducts}, Variants: ${totalVariants}`);
  } catch (err) {
    console.error('❌ Sync failed:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

syncAllProducts();
