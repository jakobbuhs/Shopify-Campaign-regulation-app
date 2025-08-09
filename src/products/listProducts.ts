// src/products/listProducts.ts - Proxy to fetch all product variants from Shopify
import express, { Request, Response } from 'express';
import { GraphQLClient, gql } from 'graphql-request';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const SHOPIFY_ADMIN_API = `https://${process.env.SHOP_DOMAIN}/admin/api/2024-10/graphql.json`;
const shopClient = new GraphQLClient(SHOPIFY_ADMIN_API, {
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN || '',
    'Content-Type': 'application/json',
  },
});

// GET /products - returns list of all product variants with simplified info
router.get('/products', async (_req: Request, res: Response) => {
  try {
    const query = gql`
      query allVariants {
        products(first: 100) {
          edges {
            node {
              id
              title
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    price
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = (await shopClient.request(query)) as any;
    const variants = data.products.edges.flatMap((p: any) =>
      p.node.variants.edges.map((v: any) => ({
        id: v.node.id,
        name: `${p.node.title} - ${v.node.title}`,
        price: v.node.price
      }))
    );

    res.json(variants);
  } catch (err: any) {
    console.error('❌ Error fetching products:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
