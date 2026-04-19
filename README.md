This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Railway

This app targets [Railway](https://railway.app/) with the default **Nixpacks** build (`npm run build`) and **`npm start`** (see `package.json`). [Node 20+](https://nodejs.org/) is declared in `package.json` `engines` and pinned for Nixpacks in [`nixpacks.toml`](nixpacks.toml).

1. Create a new project from this GitHub repo.
2. Under **Variables**, add at least **`KINGUIN_API_KEY`** (required for the catalog). Optional Telegram variables are listed in [`.env.example`](.env.example).
3. **Persistent data (Telegram bot, orders, tax, coupons, hero IDs):** add a [Volume](https://docs.railway.com/guides/volumes) on the service, mount it (for example at `/data`), then set **`DATA_DIR=/data`** to match that mount path. Without a volume, redeploys reset filesystem state under the default `./data` folder.
4. Deploy; Railway sets **`PORT`** automatically for `next start`.

Local secrets: copy `.env.example` to `.env` (not committed).
