/**
 * Renders the app icons (home screen + notification badge) from the logo mark
 * into public/. Run once after changing the mark: pnpm tsx scripts/make-icons.tsx
 */
import { writeFileSync } from 'node:fs';
import React from 'react';
import { ImageResponse } from 'next/og';

const BOLT = 'M13 2 3 14h9l-1 8 10-12h-9l1-8z'; // lucide "zap"

function Mark({ size, badge }: { size: number; badge?: boolean }) {
  const glyph = Math.round(size * (badge ? 0.8 : 0.5));
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: badge ? 'transparent' : '#111113',
      }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 24 24">
        <path d={BOLT} fill={badge ? '#ffffff' : '#ffc21a'} stroke={badge ? '#ffffff' : '#ffc21a'} strokeWidth={2} strokeLinejoin="round" />
      </svg>
    </div>
  );
}

async function render(file: string, size: number, badge = false) {
  const res = new ImageResponse(<Mark size={size} badge={badge} />, { width: size, height: size });
  writeFileSync(`public/${file}`, Buffer.from(await res.arrayBuffer()));
  console.log(`public/${file}`);
}

(async () => {
  await render('icon-192.png', 192);
  await render('icon-512.png', 512);
  await render('apple-touch-icon.png', 180);
  // Android shows the badge as a white silhouette in the status bar.
  await render('badge-72.png', 72, true);
})();
