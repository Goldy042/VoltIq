'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Logo } from '@/components/ui/Logo';
import { IssueIcon } from '@/components/ui/Badges';
import { AnimatedCount } from '@/components/ui/AnimatedCount';
import { useOutageFeed } from '@/hooks/useOutageFeed';
import { NSUKKA_CENTER, issueMeta } from '@/data/nsukka';

const StreetGlow = dynamic(() => import('@/components/dashboard/StreetGlow').then((m) => m.StreetGlow), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#0b0b0d]" />,
});

const ease = [0.23, 1, 0.32, 1] as const;
const TOWN = { lat: NSUKKA_CENTER.lat - 0.001, lng: NSUKKA_CENTER.lng };
const NO_PADDING = {};

interface AuthShellProps {
  /** Changing this re-plays the heading animation (e.g. per step). */
  stepKey: string;
  title: string;
  intro: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Sign-in / sign-up frame: the live night map of Nsukka (the same world as the
 * landing page) with the form rising over it on phones, beside it on desktop.
 */
export function AuthShell({ stepKey, title, intro, children, footer }: AuthShellProps) {
  const reducedMotion = Boolean(useReducedMotion());
  const { incidents, dots, lastEvent } = useOutageFeed();
  const reports = incidents.filter((i) => i.status !== 'restored').reduce((s, i) => s + i.reports, 0);

  return (
    <div className="min-h-dvh bg-[#0b0b0d] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:bg-surface">
      {/* Night panel: top band on phones, right half on desktop */}
      <div className="relative h-[32svh] min-h-[220px] overflow-hidden lg:order-2 lg:m-3 lg:h-[calc(100dvh-24px)] lg:rounded-xl">
        <StreetGlow
          home={TOWN}
          incidents={incidents}
          dots={dots}
          padding={NO_PADDING}
          reducedMotion={reducedMotion}
          zoom={13.9}
          reach={4200}
          showHome={false}
          labels={false}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),16px)] lg:hidden">
          <span className="pointer-events-auto">
            <Logo inverted />
          </span>
        </div>

        <div className="pointer-events-none absolute left-5 top-[calc(max(env(safe-area-inset-top),16px)+52px)] lg:left-8 lg:top-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#17181b] px-3 py-1.5 font-body text-xs font-medium text-white/80">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="animate-pulse-ring absolute inset-0 rounded-full bg-[#ff4d50]" />
              <span className="relative h-2 w-2 rounded-full bg-[#ff4d50]" />
            </span>
            Live in Nsukka · <AnimatedCount value={reports} /> reports
          </span>
        </div>

        {/* Desktop caption + live ticker */}
        <div className="pointer-events-none absolute inset-x-8 bottom-8 hidden lg:block">
          <AnimatePresence mode="popLayout">
            {lastEvent && (
              <motion.div
                key={lastEvent.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-3.5 text-[#111113]"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: issueMeta[lastEvent.issue].color }}
                >
                  <IssueIcon issue={lastEvent.issue} className="h-3.5 w-3.5" />
                </span>
                <span className="truncate font-body text-xs">
                  <span className="font-semibold">{lastEvent.name}</span> just reported {issueMeta[lastEvent.issue].label.toLowerCase()} ·{' '}
                  {lastEvent.place}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <p className="max-w-[24ch] font-display text-3xl font-bold leading-snug tracking-tight text-white">
            Every glow is a home in Nsukka.
          </p>
          <p className="mt-2 max-w-[42ch] font-body text-sm text-white/60">
            Every dot is a neighbour who reported. Join them and you’ll hear first when the light is about to go.
          </p>
        </div>
      </div>

      {/* Form: a sheet over the map on phones, the left column on desktop */}
      <div className="relative z-10 -mt-6 flex min-h-[calc(100dvh-32svh+24px)] flex-col rounded-t-xl bg-surface px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-7 sm:px-10 lg:order-1 lg:mt-0 lg:min-h-dvh lg:rounded-none lg:pt-0">
        <header className="hidden h-20 items-center justify-between lg:flex">
          <Logo />
          <Link href="/map" className="font-body text-sm font-medium text-ink-muted transition-colors hover:text-ink">
            View live map
          </Link>
        </header>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col lg:justify-center lg:pb-20">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={stepKey}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease }}
            >
              <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">{title}</h1>
              <div className="mt-2 font-body text-base leading-body text-ink-muted">{intro}</div>
              <div className="mt-8">{children}</div>
            </motion.div>
          </AnimatePresence>
          {footer && <div className="mt-8 font-body text-sm text-ink-muted">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
