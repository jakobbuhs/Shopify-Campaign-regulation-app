"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const graphql_request_1 = require("graphql-request");
const prisma = new client_1.PrismaClient();
const API = `https://${process.env.SHOP_DOMAIN}/admin/api/2024-10/graphql.json`;
const client = new graphql_request_1.GraphQLClient(API, {
    headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN || '',
        'Content-Type': 'application/json',
    },
});
const PRODUCTS_QUERY = (0, graphql_request_1.gql) `
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
const VARIANTS_QUERY = (0, graphql_request_1.gql) `
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
async function fetchAllVariants(productId) {
    let cursor = null;
    let edges = [];
    let hasNext = true;
    while (hasNext) {
        const resp = (await client.request(VARIANTS_QUERY, { productId, cursor }));
        const vConn = resp.product.variants;
        edges = edges.concat(vConn.edges);
        hasNext = vConn.pageInfo.hasNextPage;
        if (hasNext && vConn.edges.length) {
            cursor = vConn.edges[vConn.edges.length - 1].cursor;
        }
        else {
            cursor = null;
        }
    }
    return edges;
}
async function syncAllProducts() {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    let productCursor = null;
    let totalProducts = 0;
    let totalVariants = 0;
    try {
        while (true) {
            const resp = (await client.request(PRODUCTS_QUERY, { cursor: productCursor }));
            const conn = resp.products;
            const edges = conn.edges;
            if (!edges.length)
                break;
            for (const edge of edges) {
                const p = edge.node;
                // Upsert product
                await prisma.product.upsert({
                    where: { id: p.id },
                    update: { title: p.title, vendor: (_a = p.vendor) !== null && _a !== void 0 ? _a : null, handle: (_b = p.handle) !== null && _b !== void 0 ? _b : null },
                    create: { id: p.id, title: p.title, vendor: (_c = p.vendor) !== null && _c !== void 0 ? _c : null, handle: (_d = p.handle) !== null && _d !== void 0 ? _d : null },
                });
                totalProducts++;
                // Fetch ALL variants for this product (handles >100)
                const allVariantEdges = await fetchAllVariants(p.id);
                const seenVariantIds = [];
                for (const vEdge of allVariantEdges) {
                    const v = vEdge.node;
                    seenVariantIds.push(v.id);
                    await prisma.variant.upsert({
                        where: { id: v.id },
                        update: {
                            title: v.title,
                            sku: (_e = v.sku) !== null && _e !== void 0 ? _e : null,
                            price: new client_1.Prisma.Decimal((_f = v.price) !== null && _f !== void 0 ? _f : '0'),
                            productId: p.id,
                        },
                        create: {
                            id: v.id,
                            title: v.title,
                            sku: (_g = v.sku) !== null && _g !== void 0 ? _g : null,
                            price: new client_1.Prisma.Decimal((_h = v.price) !== null && _h !== void 0 ? _h : '0'),
                            productId: p.id,
                        },
                    });
                    totalVariants++;
                }
                // Optional cleanup of orphans:
                // await prisma.variant.deleteMany({ where: { productId: p.id, id: { notIn: seenVariantIds } } });
            }
            productCursor = edges[edges.length - 1].cursor;
            if (!conn.pageInfo.hasNextPage)
                break;
        }
        console.log(`✅ Sync complete. Products: ${totalProducts}, Variants: ${totalVariants}`);
    }
    catch (err) {
        console.error('❌ Sync failed:', err);
        process.exitCode = 1;
    }
    finally {
        await prisma.$disconnect();
    }
}
syncAllProducts();
