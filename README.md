# Snazzyboy Signature — Static site

A fully static rewrite of the Snazzyboy Signature website using only HTML, CSS
and JavaScript. No build step, no `npm install`, no framework. Drop the folder
on GitHub Pages (or any static host) and it works.

The shop is still powered by **Shopify Storefront API** and the quote form is
still powered by **Supabase** — both call out from the browser, so hosting on
GitHub Pages is entirely free.

## Files

```
.
├── index.html          Home (Hero, Services, Custom Apparel, About, Contact)
├── shop.html           Live Shopify shop with category filter
├── product.html        Product detail page (reads ?handle= from URL)
├── quote.html          Quote request form (Supabase)
├── 404.html            Branded "page not found"
├── favicon.ico
├── placeholder.svg
├── robots.txt
├── sitemap.xml
├── .nojekyll           Tells GitHub Pages not to run Jekyll
└── assets/
    ├── img/hero.jpg
    ├── css/styles.css
    └── js/
        ├── config.js   <- Shopify + Supabase + contact details (edit here)
        ├── icons.js    Inline lucide-style SVG icons
        ├── shopify.js  Storefront API client + GraphQL queries
        ├── cart.js     localStorage-backed cart, syncs with Shopify
        ├── ui.js       Navbar, mobile menu, cart drawer, toasts
        ├── shop.js     Shop page logic
        ├── product.js  Product page logic
        └── quote.js    Quote form logic + Supabase upload
```

## Deploy to GitHub Pages

1. Create a new GitHub repository (any name).
2. Push the contents of this folder to the repo's `main` branch.
   ```bash
   git init
   git add .
   git commit -m "Initial static site"
   git branch -M main
   git remote add origin git@github.com:<you>/<repo>.git
   git push -u origin main
   ```
3. In the repo go to **Settings → Pages** and set:
   - **Source**: Deploy from a branch
   - **Branch**: `main` / `/ (root)`
4. GitHub will publish the site at:
   - `https://<you>.github.io/<repo>/` for a regular repo, or
   - `https://<you>.github.io/` if the repo is named `<you>.github.io`.

All links in the site use **relative URLs** (`href="shop.html"` rather than
`/shop.html`) so it works whether the site lives at the root or inside a
sub-path. The 404 page does use absolute paths (`/assets/...`) since GitHub
Pages serves it from any depth — for sub-path repos open the site root and
non-existent pages will still show the 404 with broken styling. If that
matters you can edit [`404.html`](404.html) and remove the leading slashes.

To use a **custom domain** (e.g. `snazzyboysignature.co.za`):
1. Add a file called `CNAME` in this folder containing the bare domain.
2. Point your DNS to GitHub Pages per the official docs.

## Local development

You can open `index.html` directly in a browser, but ES modules and the
Supabase / Shopify clients prefer a real HTTP origin. Easiest:

```bash
# Python (any version 3.x)
python -m http.server 5173

# Node
npx serve .
```

Then visit <http://localhost:5173>.

## Editing the content

- **Text and layout** live directly in the `.html` files — open them in any
  editor and change the markup. Sections use simple `<section>` blocks with
  hand-written CSS classes (no Tailwind).
- **Colours, fonts and spacing** live as CSS custom properties at the top of
  [`assets/css/styles.css`](assets/css/styles.css) (`--primary`, `--background`,
  `--gradient-gold`, etc.).
- **Contact details, Shopify store and Supabase keys** all live in
  [`assets/js/config.js`](assets/js/config.js). Change them here and every
  page picks up the new values.

## Adding products

Products are pulled live from Shopify, so you don't add them here — add them
inside the Shopify admin and they appear on `shop.html` automatically.

To filter products into the right category on `shop.html`, the page uses
keyword regex matchers in [`assets/js/shop.js`](assets/js/shop.js) (look for
the `CATEGORIES` array). Make sure your Shopify product titles or descriptions
contain words like *PPE*, *Hi-vis*, *uniform*, *embroidered*, etc., or extend
the regex.

## Switching to a different Shopify store

Edit [`assets/js/config.js`](assets/js/config.js):

```js
export const SHOPIFY = {
  domain: "your-store.myshopify.com",
  apiVersion: "2025-07",
  storefrontToken: "your-storefront-access-token",
};
```

The Storefront token is meant to be public — generate one under
**Apps → Develop apps → Storefront API access** in the Shopify admin.

## Switching off Supabase (going truly $0)

Supabase has a generous free tier and the current setup works without any
billing. If you ever want to remove it entirely (e.g. to drop the dependency
or move to a different form provider), here are the options:

1. **Formspree / Web3Forms** — replace the body of `submit()` in
   [`assets/js/quote.js`](assets/js/quote.js) with a `fetch()` POST to the
   form-service endpoint. They handle file attachments and email-forwarding
   for free up to ~50 submissions/month.
2. **Pure mailto / WhatsApp** — the form already builds a `mailto:` fallback
   automatically when Supabase fails (see `buildMailtoFallback`). To make
   this the default, replace the body of `submit()` with
   `window.location.href = buildMailtoFallback(form)`. No backend, no cost,
   no file attachments.

The Supabase migration that creates the `quote_requests` table and
`quote-uploads` storage bucket is preserved in the **original** project at
`../snazzy-signature-shop-main/supabase/migrations/` for reference.

## Brand colours / fonts

| Token              | Value                                |
|--------------------|--------------------------------------|
| Background         | `hsl(0 0% 5%)`                       |
| Foreground         | `hsl(45 25% 92%)`                    |
| Gold (primary)     | `hsl(43 74% 52%)`                    |
| Gold gradient      | `linear-gradient(135deg, hsl(43 74% 52%), hsl(45 90% 65%))` |
| Display font       | Cormorant Garamond                   |
| Body font          | Inter                                |

Fonts come from Google Fonts and are preconnected on every page.
