import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/uploads/receipts/:name",
        destination: "/api/uploads/receipt/:name",
      },
    ];
  },
};

export default withNextIntl(nextConfig);
