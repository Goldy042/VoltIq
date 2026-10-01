'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRightIcon } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

const ease = [0.23, 1, 0.32, 1] as const;

const actions = [
  {
    href: '/report',
    verb: 'Report it',
    detail: 'No light, low voltage or unstable supply. One tap, with or without an account.',
  },
  {
    href: '/map',
    verb: 'See it',
    detail: 'Every report in Nsukka right now, and where the EEDC crews are.',
  },
  {
    href: '/signup',
    verb: 'Hear first',
    detail: 'Pick your area and get an alert when the AI expects your light to go.',
  },
];

export function Outro() {
  return (
    <>
      <section aria-labelledby="outro-title" className="bg-canvas">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-12 lg:px-10 lg:pb-24">
          <motion.h2
            id="outro-title"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.6, ease }}
            className="max-w-[16ch] font-display text-4xl font-bold leading-snug tracking-tight text-ink"
          >
            Morning in Nsukka. Light’s back. Here’s how you join in.
          </motion.h2>

          <ol className="mt-10 border-t border-line lg:mt-14">
            {actions.map((a, i) => (
              <motion.li
                key={a.href}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.5, delay: i * 0.08, ease }}
                className="border-b border-line"
              >
                <Link href={a.href} className="group relative flex items-center gap-4 py-6 lg:gap-10 lg:py-9">
                  <span className="w-8 shrink-0 font-body text-sm font-semibold tabular-nums text-ink-faint">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1 lg:flex lg:items-baseline lg:gap-10">
                    <span className="block font-display text-4xl font-bold tracking-tight text-ink transition-transform duration-300 ease-out group-hover:translate-x-2 lg:w-[9ch] lg:shrink-0 lg:text-5xl">
                      {a.verb}
                    </span>
                    <span className="mt-1 block max-w-[44ch] font-body text-base leading-snug text-ink-muted lg:mt-0">
                      {a.detail}
                    </span>
                  </span>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink transition-[background-color,border-color,color,transform] duration-300 ease-out group-hover:-rotate-45 group-hover:border-ink group-hover:bg-ink group-hover:text-canvas">
                    <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                </Link>
              </motion.li>
            ))}
          </ol>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.6, ease }}
            className="mt-16 grid gap-6 lg:mt-24 lg:grid-cols-[1fr_auto] lg:items-end"
          >
            <p className="max-w-[30ch] font-display text-2xl font-semibold leading-snug tracking-tight text-ink lg:text-3xl">
              Work at EEDC Nsukka? The same map is your dispatch console: faults ranked by homes affected, the nearest crew
              one tap away.
            </p>
            <Link
              href="/operator"
              className="group inline-flex h-12 items-center gap-2 self-start rounded-full bg-ink px-5 font-body text-sm font-semibold text-canvas transition-transform active:scale-95 lg:self-end"
            >
              Open the console
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </motion.div>
        </div>
      </section>

      <footer className="bg-canvas">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 border-t border-line px-5 py-10 pb-[max(env(safe-area-inset-bottom),40px)] lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <Logo />
          <p className="max-w-[60ch] font-body text-xs leading-body text-ink-faint">
            Buildings, roads and map data © OpenStreetMap contributors, tiles by OpenFreeMap. Outages, crews and forecasts shown
            here are demo data, not live EEDC information. © 2026 VoltIq.
          </p>
        </div>
      </footer>
    </>
  );
}
