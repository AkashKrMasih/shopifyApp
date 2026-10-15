# Shopify "My Orders" app

A tiny Shopify app that shows the **currently logged-in customer's orders** on your storefront.

- Customer visits `https://YOUR-STORE.com/apps/my-orders`
- Shopify forwards the request to this Node/Express server through an **App Proxy**
  and adds the logged-in customer's ID, signed with your app secret
- The server verifies the signature, gets an Admin API token (client credentials grant),
  fetches that customer's orders with GraphQL, and renders a simple table

## Requirements

- Node.js 18 or newer
- A Shopify development store and an app created in the Shopify Dev Dashboard
  (the app and the store must belong to the same organization)
- A tunnel to expose localhost over HTTPS, e.g. [ngrok](https://ngrok.com)
- At least one customer account with a few test orders in the store

## Setup

### 1. Install dependencies and start the tunnel

```bash
npm install
cp .env.example .env
ngrok http --url=YOUR-STATIC-DOMAIN.ngrok-free.dev 3000
```

### 2. Configure the app (Dev Dashboard > your app > Versions > Create version)

- **App URL**: `https://YOUR-STATIC-DOMAIN.ngrok-free.dev`
- **Scopes**: `read_orders,read_customers`
- **Use legacy install flow**: off
- **App proxy**
  - Prefix: `apps`
  - Subpath: `my-orders`
  - Proxy URL: `https://YOUR-STATIC-DOMAIN.ngrok-free.dev/proxy/orders`
- Click **Release**

### 3. Fill in `.env`

```
SHOPIFY_API_KEY=<Client ID from app Settings>
SHOPIFY_API_SECRET=<Client secret from app Settings>
SHOP=your-store.myshopify.com
```

### 4. Install the app on your store

In the Dev Dashboard open your app, go to **Overview**, choose **Install app** and select your store.
No redirect URL is needed because the server asks Shopify for its token directly.

### 5. Run it

```bash
npm start
```

### 6. Try it

1. On your storefront, log in as a customer who has orders (`/account/login`).
2. Open `https://your-store.myshopify.com/apps/my-orders`.
3. You should see that customer's latest 25 orders. If you're logged out you'll see a login prompt.

## Troubleshooting

- **"Token request failed"** in the server logs: check `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` and `SHOP`,
  and make sure the app is installed on that store and that both belong to the same organization.
- **"Invalid signature"** on the page: `SHOPIFY_API_SECRET` is wrong, or you opened the ngrok URL directly.
  Always open the page via the storefront `/apps/my-orders` URL.
- **Empty list:** orders only appear for the customer who is logged in, and the Admin API only
  returns the last 60 days of orders unless the app has the `read_all_orders` scope.
- **ngrok warning page:** shown only to browsers visiting the ngrok URL directly. Shopify's proxy requests are not affected.

## Notes

- Tokens last about 24 hours; the server caches one in memory and fetches a new one automatically.
- For production, deploy to any Node host and use your permanent domain instead of ngrok.
- The customer ID is trusted only after the App Proxy signature is verified.

## Files

| File | Purpose |
|------|---------|
| `server.ts` | Express server: App Proxy route, token handling, order listing |
| `templates/proxy-orders.ejs` | Storefront markup for `/proxy/orders` (rendered to Liquid for the theme layout) |
| `lib/renderProxyOrders.ts` | Renders the proxy orders template with view data |
| `tsconfig.json` | TypeScript compiler options (`npm run build` emits `dist/`) |
| `.env.example` | Environment variable template |
| `package.json` | Dependencies and `npm start` script |


cloudflared tunnel --url http://localhost:3000
