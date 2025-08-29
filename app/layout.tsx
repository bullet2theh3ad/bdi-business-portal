import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { SWRConfig } from 'swr';
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const manrope = Manrope({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BDI Business Portal',
  description: 'CPFR Supply Chain Management'
};

export const viewport: Viewport = {
  maximumScale: 1
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`bg-white dark:bg-gray-950 text-black dark:text-white ${manrope.className}`}
    >
                    <head>
                <link
                  href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap"
                  rel="stylesheet"
                />
                <link rel="icon" type="image/png" sizes="32x32" href="/icons/PNG/32x32.png" />
                <link rel="icon" type="image/png" sizes="16x16" href="/icons/PNG/16x16.png" />
                <link rel="apple-touch-icon" sizes="180x180" href="/icons/PNG/180x180.png" />
              </head>
      <body className="min-h-[100dvh] bg-gray-50">
        <SWRConfig
          value={{
            fallback: {
              // Empty fallback for now - will be populated when user is authenticated
            }
          }}
        >
          {children}
        </SWRConfig>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
