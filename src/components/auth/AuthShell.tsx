'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Logo } from '@/components/ui/Logo';
import { MapCanvas } from '@/components/map';
import { incidents, predictions } from '@/data/nsukka';

interface AuthShellProps {
  title: string;
  intro: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

/** Form on the left; on desktop, the live Nsukka map fills the right. */
export function AuthShell({ title, intro, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-dvh bg-surface lg:grid lg:grid-cols-[minmax(0,560px)_1fr]">
      <div className="flex min-h-dvh flex-col px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-[max(env(safe-area-inset-top),16px)] sm:px-10">
        <header className="flex h-12 items-center justify-between">
          <Logo />
          <Link href="/map" className="font-body text-sm font-medium text-ink-muted transition-colors hover:text-ink">
            View live map
          </Link>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
          className="mx-auto w-full max-w-md flex-1 py-10 lg:py-16"
        >
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
          <p className="mt-2 font-body text-base leading-body text-ink-muted">{intro}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-8 font-body text-sm text-ink-muted">{footer}</div>
        </motion.div>
      </div>

      <div className="relative hidden p-3 lg:block">
        <div className="sticky top-3 h-[calc(100dvh-24px)] overflow-hidden rounded-xl bg-sunken">
          <MapCanvas interactive={false} incidents={incidents} predictions={predictions} initialZoom={13.4} />
          <div className="absolute bottom-5 left-5 right-5 max-w-sm rounded-lg bg-surface p-4 shadow-float">
            <p className="font-display text-base font-bold text-ink">Nsukka, live</p>
            <p className="mt-1 font-body text-sm text-ink-muted">
              Every pin is neighbours reporting no light or low voltage. Purple zones are where the AI expects trouble next.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
