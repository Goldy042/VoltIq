import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Leaflet ships untranspiled ESM/CJS that Turbopack handles fine, but the
  // marker-cluster plugin reaches for `window` at module scope. Every map entry
  // point is therefore imported with `next/dynamic({ ssr: false })` rather than
  // being excluded here.
  reactStrictMode: true,
};

export default nextConfig;
