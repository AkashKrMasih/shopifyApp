# Bootstrap Basic – Shopify Theme

A minimal Shopify Online Store 2.0 theme using **Bootstrap 5.3** (via CDN) with a responsive header (logo, menu with dropdowns, search, account, cart count) and footer (text, menu, newsletter, copyright).

## Structure

```
assets/      theme.css, theme.js
config/      settings_schema.json, settings_data.json
layout/      theme.liquid  (loads Bootstrap, renders header/footer groups)
locales/     en.default.json
sections/    header, footer, hero, featured-collection, main-* sections
snippets/    product-card.liquid
templates/   index, product, collection, cart, page, search, 404, list-collections (JSON)
```

## Option A – Upload as ZIP (easiest)

1. Zip the **contents** of the theme folder (the folders `assets`, `config`, `layout`... must be at the root of the zip, not inside a parent folder).
2. Shopify Admin → **Online Store → Themes**.
3. **Add theme → Upload zip file**, choose the zip.
4. The theme appears in the library as **unpublished**.
5. Click **Customize**:
   - Header: upload logo, choose menu (default `main-menu`), toggle sticky.
   - Footer: set heading/text, choose menu (default `footer`).
   - Add/arrange sections on the home page.
6. **Preview** on desktop and mobile. Test: add to cart, cart page, checkout, search, 404.
7. When happy: **Actions → Publish** (or the **Publish** button).

## Option B – Shopify CLI (recommended for development)

```bash
# 1. Install the CLI (Node.js 18+)
npm install -g @shopify/cli

# 2. Go to the theme folder
cd bootstrap-basic-theme

# 3. Log in and live-preview against your store
shopify theme dev --store your-store.myshopify.com

# 4. Check for errors
shopify theme check

# 5. Push as a NEW unpublished theme
shopify theme push --unpublished --store your-store.myshopify.com

# 6. Publish from Admin (Online Store → Themes → Publish),
#    or from the CLI:
shopify theme publish
```

## Option C – GitHub integration

1. Push this folder to a GitHub repo (theme files at the repo root).
2. Admin → **Online Store → Themes → Add theme → Connect from GitHub**.
3. Pick the repo and branch. Shopify syncs changes automatically.
4. Publish the theme once you've previewed it.

## Before you publish – checklist

- [ ] Duplicate your current live theme as a backup (**Actions → Duplicate**).
- [ ] Make sure the menus exist: **Content → Menus** (`main-menu`, `footer`).
- [ ] Re-add any app embeds in **Customize → App embeds**.
- [ ] Copy over tracking scripts, favicon (**Settings** in theme editor), and custom code from the old theme.
- [ ] Test checkout, discount codes, and mobile layout.
- [ ] Remove the "password page" only if you're ready to go live (**Preferences**).

## Updating Bootstrap

Bootstrap is loaded from jsDelivr in `layout/theme.liquid`. To upgrade, change the version number in both the CSS and JS URLs (check https://getbootstrap.com for the latest 5.3.x release). To self-host, download `bootstrap.min.css` and `bootstrap.bundle.min.js` into `assets/` and reference them with `{{ 'bootstrap.min.css' | asset_url | stylesheet_tag }}`.

## Customizing

- Colors/fonts: add Bootstrap CSS variable overrides in `assets/theme.css`, e.g. `:root { --bs-body-font-family: Georgia, serif; }`.
- Header/footer markup: `sections/header.liquid`, `sections/footer.liquid`.
- Add new sections in `sections/` with a `{% schema %}` block and a `presets` entry so they appear in the theme editor.
