import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VoltIq — Nsukka power',
    short_name: 'VoltIq',
    description: 'Report outages, see who else is off, and hear when light is back in Nsukka.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f3f3f0',
    theme_color: '#111113',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
