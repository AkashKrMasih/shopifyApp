require('dotenv').config();
const express = require('express');
const crypto = require('crypto');

const {
  SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOP,
  PORT = 3000,
} = process.env;

const API_VERSION = '2025-10';
const app = express();

// ---------- helpers ----------
// Gets an Admin API token with the client credentials grant (no redirect needed).
// Tokens last ~24h, so we cache it in memory and refresh shortly before it expires.
let cached = { token: null, expiresAt: 0 };
async function getToken() {
  if (cached.token && Date.now() < cached.expiresAt - 60_000) return cached.token;
  const r = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
    }),
  });
  const json = await r.json();
  if (!json.access_token) throw new Error('Token request failed: ' + JSON.stringify(json));
  cached = { token: json.access_token, expiresAt: Date.now() + (json.expires_in || 86400) * 1000 };
  return cached.token;
}

const hmac = (msg) =>
  crypto.createHmac('sha256', SHOPIFY_API_SECRET).update(msg).digest('hex');

const safeEqual = (a = '', b = '') => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Verify the signature Shopify adds to App Proxy requests
function verifyProxy(query) {
  const { signature, ...rest } = query;
  const message = Object.keys(rest).sort()
    .map((k) => `${k}=${Array.isArray(rest[k]) ? rest[k].join(',') : rest[k]}`)
    .join('');
  return safeEqual(hmac(message), signature);
}

async function fetchOrders(customerId) {
  const res = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': await getToken() },
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
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.orders.nodes;
}

const page = (body) => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>My orders</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;color:#222}
  table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #e5e5e5}
  th{font-size:.8rem;text-transform:uppercase;color:#666}
</style></head><body>${body}</body></html>`;

// ---------- App Proxy: /apps/my-orders  ->  /proxy/orders ----------
app.get('/proxy/orders', async (req, res) => {
  if (!verifyProxy(req.query)) return res.status(401).send('Invalid signature');

  // Shopify sets this only when a customer is logged in on the storefront
  const customerId = req.query.logged_in_customer_id;
  if (!customerId) {
    return res.send(page(`<h1>My orders</h1>
      <p>Please <a href="/account/login">log in</a> to see your orders.</p>`));
  }

  try {
    const orders = await fetchOrders(customerId);
    const rows = orders.map((o) => {
      const p = o.currentTotalPriceSet.shopMoney;
      return `<tr>
        <td>${esc(o.name)}</td>
        <td>${esc(new Date(o.createdAt).toLocaleDateString())}</td>
        <td>${esc(o.displayFinancialStatus)}</td>
        <td>${esc(o.displayFulfillmentStatus)}</td>
        <td>${esc(p.amount)} ${esc(p.currencyCode)}</td>
      </tr>`;
    }).join('');

    res.send(page(`<h1>My orders</h1>` + (orders.length
      ? `<table><thead><tr><th>Order</th><th>Date</th><th>Payment</th><th>Fulfillment</th><th>Total</th></tr></thead>
         <tbody>${rows}</tbody></table>`
      : `<p>You have no orders yet.</p>`)));
  } catch (err) {
    console.error(err);
    res.status(500).send(page('<p>Something went wrong loading your orders.</p>'));
  }
});

app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
