"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/products/listProducts.ts - Proxy to fetch all product variants from Shopify
const express_1 = __importDefault(require("express"));
const graphql_request_1 = require("graphql-request");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const router = express_1.default.Router();
const SHOPIFY_ADMIN_API = `https://${process.env.SHOP_DOMAIN}/admin/api/2024-10/graphql.json`;
const shopClient = new graphql_request_1.GraphQLClient(SHOPIFY_ADMIN_API, {
    headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN || '',
        'Content-Type': 'application/json',
    },
});
// GET /products - returns list of all product variants with simplified info
router.get('/products', async (_req, res) => {
    try {
        const query = (0, graphql_request_1.gql) `
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
        const data = (await shopClient.request(query));
        const variants = data.products.edges.flatMap((p) => p.node.variants.edges.map((v) => ({
            id: v.node.id,
            name: `${p.node.title} - ${v.node.title}`,
            price: v.node.price
        })));
        res.json(variants);
    }
    catch (err) {
        console.error('❌ Error fetching products:', err);
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
