// src/auth/oauth.ts
import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const router = express.Router();
const prisma = new PrismaClient();

const { SHOPIFY_API_KEY, SHOPIFY_API_SECRET, APP_URL } = process.env;
const SCOPES = [
  'read_products','write_products',
  'read_discounts','write_discounts',
  'read_price_rules','write_price_rules',
  'read_orders',
].join(',');

// 1) Kick off OAuth
router.get('/auth', async (req, res) => {
  const shop = String(req.query.shop || '').toLowerCase();
  if (!shop.endsWith('.myshopify.com')) return res.status(400).send('Invalid shop');

  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = `${APP_URL}/auth/callback`;
  const url = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${encodeURIComponent(SCOPES)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&grant_options[]=offline`;

  // store state in a signed cookie
  res.cookie('state', state, { httpOnly: true, sameSite: 'lax', secure: true });
  res.redirect(url);
});

// 2) Callback: exchange code for token
router.get('/auth/callback', async (req, res) => {
  const { shop, code, state, hmac } = req.query as Record<string,string>;
  if (!shop || !code || !state || !hmac) return res.status(400).send('Missing params');

  // verify HMAC
  const msg = Object.entries(req.query)
    .filter(([k]) => k !== 'hmac')
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([k,v]) => `${k}=${v}`).join('&');
  const digest = crypto.createHmac('sha256', SHOPIFY_API_SECRET!).update(msg).digest('hex');
  if (digest !== hmac) return res.status(400).send('Invalid HMAC');

  // verify state
  // (OPTION: compare with cookie you set earlier; omitted for brevity in this snippet)

  // exchange code
  const tokenResp = await axios.post(`https://${shop}/admin/oauth/access_token`, {
    client_id: SHOPIFY_API_KEY,
    client_secret: SHOPIFY_API_SECRET,
    code,
  });

  const accessToken = tokenResp.data.access_token as string;

  // upsert Shop
  await prisma.shop.upsert({
    where: { domain: shop },
    create: { domain: shop, accessToken, scopes: SCOPES },
    update: { accessToken, scopes: SCOPES },
  });

  // register required webhooks for this shop here (uninstalled + GDPR)… see next section

  // send merchant into your app UI (embedded or external)
  res.redirect('/'); // or your embedded app route
});

export default router;
