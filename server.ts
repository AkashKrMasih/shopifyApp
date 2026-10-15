import 'dotenv/config';
import crypto from 'crypto';
import express, { type Request, type Response } from 'express';
import type { ParsedQs } from 'qs';
import { renderProxyOrders } from './lib/renderProxyOrders';
import type { OrderNode } from './lib/types';

const {
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  SHOP,
  PORT = '3000',
} = process.env;

if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET || !SHOP) {
  throw new Error('Missing SHOPIFY_API_KEY, SHOPIFY_API_SECRET, or SHOP in environment');
}

const shop = SHOP;
const shopifyApiKey = SHOPIFY_API_KEY;
const shopifyApiSecret = SHOPIFY_API_SECRET;

const API_VERSION = '2025-10';
const app = express();
const listenPort = Number(PORT);

interface CachedToken {
  token: string | null;
  expiresAt: number;
}

let cached: CachedToken = { token: null, expiresAt: 0 };

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
}

async function getToken(): Promise<string> {
  if (cached.token && Date.now() < cached.expiresAt - 60_000) return cached.token;
  const r = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: shopifyApiKey,
      client_secret: shopifyApiSecret,
    }),
  });
  const json = (await r.json()) as TokenResponse;
  if (!json.access_token) throw new Error('Token request failed: ' + JSON.stringify(json));
  cached = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in || 86400) * 1000,
  };
  return cached.token as string;
}

const hmac = (msg: string) =>
  crypto.createHmac('sha256', shopifyApiSecret).update(msg).digest('hex');

const safeEqual = (a = '', b = '') => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function queryValue(value: string | ParsedQs | (string | ParsedQs)[] | undefined): string {
  if (value === undefined) return '';
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'string' ? v : '')).join(',');
  }
  return typeof value === 'string' ? value : '';
}

function verifyProxy(query: ParsedQs): boolean {
  const { signature, ...rest } = query;
  const sig = typeof signature === 'string' ? signature : '';
  const message = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${queryValue(rest[k])}`)
    .join('');
  return safeEqual(hmac(message), sig);
}

interface OrdersGraphQLResponse {
  data?: { orders: { nodes: OrderNode[] } };
  errors?: unknown;
}

async function fetchOrders(customerId: string): Promise<OrderNode[]> {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': await getToken(),
    },
    body: JSON.stringify({
      query: `query($q: String!) {
        orders(first: 25, sortKey: CREATED_AT, reverse: true, query: $q) {
          nodes {
            name
            createdAt
            displayFinancialStatus
            displayFulfillmentStatus
            currentTotalPriceSet { shopMoney { amount currencyCode } }
          }
        }
      }`,
      variables: { q: `customer_id:${customerId}` },
    }),
  });
  const json = (await res.json()) as OrdersGraphQLResponse;
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  if (!json.data) throw new Error('Orders query returned no data');
  return json.data.orders.nodes;
}

async function sendProxyOrdersPage(
  res: Response,
  locals: Parameters<typeof renderProxyOrders>[0],
): Promise<void> {
  res.set('Content-Type', 'application/liquid; charset=utf-8');
  res.send(await renderProxyOrders(locals));
}

app.get('/proxy/orders', async (req: Request, res: Response) => {
  if (!verifyProxy(req.query)) return res.status(401).send('Invalid signature');

  const customerId = req.query.logged_in_customer_id;
  if (typeof customerId !== 'string' || !customerId) {
    return sendProxyOrdersPage(res, { state: 'login' });
  }

  try {
    const orders = await fetchOrders(customerId);
    const state = orders.length ? 'orders' : 'empty';
    await sendProxyOrdersPage(res, { state, orders });
  } catch (err) {
    console.error(err);
    res.status(500);
    await sendProxyOrdersPage(res, { state: 'error' });
  }
});

app.listen(listenPort, () => console.log(`Listening on http://localhost:${listenPort}`));
