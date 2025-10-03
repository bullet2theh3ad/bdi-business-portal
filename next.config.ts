import type { NextConfig } from 'next';
// import createNextIntlPlugin from 'next-intl/plugin'; // TODO: Enable after proper setup

// const withNextIntl = createNextIntlPlugin('./i18n.ts'); // TODO: Enable after proper setup

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
    nodeMiddleware: true,
    clientSegmentCache: true
  },
  images: {
    domains: ['bdibusinessportal.com'],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Enable static exports for better performance
  output: 'standalone',
};

export default nextConfig; // TODO: Change to withNextIntl(nextConfig) after proper setup