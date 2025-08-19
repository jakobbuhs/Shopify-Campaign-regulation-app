// src/lib/shopClient.ts
import { PrismaClient, Shop } from '@prisma/client';
import { GraphQLClient } from 'graphql-request';

const prisma = new PrismaClient();

/**
 * Returns a GraphQLClient for the given shop domain.
 * If no domain is provided, it falls back to the most recently installed shop.
 */
export async function getClientForShop(domain?: string): Promise<GraphQLClient> {
  const shop = await pickShop(domain);
  return new GraphQLClient(`https://${shop.domain}/admin/api/2024-10/graphql.json`, {
    headers: {
      'X-Shopify-Access-Token': shop.accessToken,
      'Content-Type': 'application/json',
    },
  });
}

/** Resolve a Shop row (by domain or latest install). Throws if none exist. */
export async function pickShop(domain?: string): Promise<Shop> {
  let shop: Shop | null = null;
  if (domain) {
    shop = await prisma.shop.findUnique({ where: { domain: domain.toLowerCase() } });
  } else {
    shop = await prisma.shop.findFirst({ orderBy: { installedAt: 'desc' } });
  }
  if (!shop) throw new Error('No installed shop found (install your app via /auth first).');
  return shop;
}

/** Convenience: get the domain we resolved (same logic as pickShop). */
export async function getShopDomainOrThrow(domain?: string): Promise<string> {
  const shop = await pickShop(domain);
  return shop.domain;
}
