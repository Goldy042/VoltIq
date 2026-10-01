'use client';

import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/components/ui/cn';

const links = [
  { label: 'Live map', href: '/map' },
  { label: 'How it works', href: '#tonight' },
  { label: 'For EEDC', href: '/operator' },
];

/** Floats over the night map, then turns light with the page. */
export function LandingNav({ tone }: { tone: 'night' | 'day' }) {
  const night = tone === 'night';
  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)] transition-colors duration-300',
        night ? 'bg-[#0b0b0d]' : 'bg-canvas shadow-card',
      )}
    >
      <nav aria-label="Primary" className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5 lg:px-10">
        <Logo inverted={night} />
        <ul className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <li key={l.label}>
              <Link
                href={l.href}
                className={cn(
                  'font-body text-sm font-medium transition-colors',
                  night ? 'text-white/65 hover:text-white' : 'text-ink-muted hover:text-ink',
                )}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/login"
            className={cn(
              'flex h-9 items-center rounded-full px-4 font-body text-sm font-medium transition-colors',
              night ? 'text-white/75 hover:bg-white/10 hover:text-white' : 'text-ink-muted hover:bg-sunken hover:text-ink',
            )}
          >
            Sign in
          </Link>
          <Link
            href="/report"
            className={cn(
              'flex h-9 items-center rounded-full px-4 font-body text-sm font-semibold transition-[colors,transform] active:scale-95',
              night ? 'bg-white text-[#111113]' : 'bg-ink text-canvas',
            )}
          >
            Report
          </Link>
        </div>
      </nav>
    </header>
  );
}
