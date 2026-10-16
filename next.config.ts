import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Leaflet ships untranspiled ESM/CJS that Turbopack handles fine, but the
  // marker-cluster plugin reaches for `window` at module scope. Every map entry
  // point is therefore imported with `next/dynamic({ ssr: false })` rather than
  // being excluded here.
  reactStrictMode: true,
  // Browsers must always fetch the newest service worker.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
