import React from 'react';
import Link from 'next/link';
import { citizenProfile } from '../../data/citizen';

export function CitizenHeader() {
  const initials = citizenProfile.name.
  split(' ').
  map((p) => p[0]).
  join('');

  return (
    <header className="sticky top-0 z-30 w-full border-b border-line bg-canvas">
      <div className="mx-auto flex w-full max-w-[1120px] items-center gap-4 px-5 py-3 md:px-8">
        <Link
          href="/"
          className="font-display text-base font-semibold tracking-tight text-ink transition-colors duration-150 ease-out hover:text-accent">
          
          Gridpulse<span className="text-accent">.</span>
        </Link>

        <nav aria-label="Citizen" className="ml-6 hidden items-center gap-6 sm:flex">
          <Link
            href="/dashboard"
            className="font-body text-sm text-ink transition-colors duration-150 ease-out hover:text-accent">
            
            Dashboard
          </Link>
          <Link
            href="/map"
            className="font-body text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink">
            
            Live map
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden font-body text-sm text-ink-muted sm:inline">
            {citizenProfile.name}
          </span>
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center border border-line-strong font-body text-2xs text-ink"
            style={{ borderRadius: 'var(--radius-sm)' }}>
            
            {initials}
          </span>
          <Link
            href="/login"
            className="font-body text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink">
            
            Sign out
          </Link>
        </div>
      </div>
    </header>);

}