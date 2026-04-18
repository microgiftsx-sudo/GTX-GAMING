# Kinguin API (storefront)

The app loads the catalog **directly** from Kinguin’s eCommerce API (`gateway.kinguin.net`). No PostgreSQL or product sync is required for browsing, search, or product pages.

## Environment

Copy [.env.example](../.env.example) to `.env` and set:

- **`KINGUIN_API_KEY`** — from [Kinguin Dev Portal](https://www.kinguin.net/dev-portal). Required for `/api/products` and `/api/products/[id]` (server-side only).

Server routes import [`src/lib/load-env.ts`](../src/lib/load-env.ts) so `.env` overrides stale machine-level env vars during development.

## Build & deploy

```bash
npm run build
```

On Vercel (or similar), add **`KINGUIN_API_KEY`** in Project → Environment Variables. **`DATABASE_URL` is not used** by this app anymore.

## API surface (this repo)

| Route | Role |
|-------|------|
| `GET /api/products` | List/search — proxies query params to Kinguin `GET /products` |
| `GET /api/products/[id]` | Detail — `GET /products/{kinguinId}` |

Implementation: [`src/lib/kinguin/client.ts`](../src/lib/kinguin/client.ts), mapping in [`src/lib/kinguin/mapProduct.ts`](../src/lib/kinguin/mapProduct.ts) and [`src/lib/store-product.ts`](../src/lib/store-product.ts).
