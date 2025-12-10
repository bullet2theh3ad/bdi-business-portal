import type { NextConfig } from 'next';
// import createNextIntlPlugin from 'next-intl/plugin'; // TODO: Enable after proper setup

// const withNextIntl = createNextIntlPlugin('./i18n.ts'); // TODO: Enable after proper setup

const nextConfig: NextConfig = {
  experimental: {
    // Removed canary-only features for stable Next.js
    // ppr: true, // Only available in canary
    // nodeMiddleware: true, // Only available in canary
  },
  images: {
    domains: ['bdibusinessportal.com'],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Enable standalone for production deployment
  output: 'standalone',
};

export default nextConfig; // TODO: Change to withNextIntl(nextConfig) after proper setup