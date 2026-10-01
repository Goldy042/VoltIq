'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface SupplyWeekProps {
  days: Array<{ day: string; hours: number }>;
  /** Minimum daily hours promised by the customer's NERC band. */
  promise: number;
  band: string;
}

const MAX = 24;
const fmt = (h: number) => (Number.isInteger(h) ? `${h}` : h.toFixed(1));

/** Hours of light per day against what the tariff band promises. */
export function SupplyWeek({ days, promise, band }: SupplyWeekProps) {
  const [active, setActive] = useState<number | null>(null);
  const met = days.filter((d) => d.hours >= promise).length;
  const avg = days.reduce((s, d) => s + d.hours, 0) / days.length;

  return (
    <section aria-labelledby="supply-title" className="rounded-xl bg-surface p-5 shadow-card lg:p-6">
      <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-faint">Your supply this week</p>
      <h2 id="supply-title" className="mt-1 font-display text-xl font-bold tracking-tight text-ink">
        {met} of {days.length} days met Band {band}
      </h2>
      <p className="mt-0.5 font-body text-sm text-ink-muted">
        Average <span className="font-semibold text-ink">{fmt(avg)} hrs</span> of light a day. Band {band} promises at least {promise}.
      </p>

      <div className="relative mt-6 h-40" role="img" aria-label={`Bar chart of daily hours of light. ${met} of ${days.length} days met the ${promise}-hour promise.`}>
        {/* Promise line */}
        <div className="pointer-events-none absolute inset-x-0 z-10" style={{ bottom: `${(promise / MAX) * 100}%` }} aria-hidden="true">
          <div className="border-t-2 border-dashed border-ink-faint" />
          <span className="absolute -top-5 right-0 font-body text-xs font-medium text-ink-muted">
            Band {band} · {promise} hrs
          </span>
        </div>

        <div className="absolute inset-0 flex items-end gap-2">
          {days.map((d, i) => (
            <button
              key={d.day}
              type="button"
              className="relative flex h-full flex-1 items-end justify-center rounded-md focus-visible:outline-offset-4"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              aria-label={`${d.day}: ${fmt(d.hours)} hours of light`}
            >
              <motion.span
                className="block w-full max-w-7 rounded-t-[4px]"
                style={{ backgroundColor: active === null || active === i ? 'var(--ink)' : 'var(--line-strong)' }}
                initial={{ height: 0 }}
                whileInView={{ height: `${(d.hours / MAX) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.05, ease: [0.23, 1, 0.32, 1] }}
              />
              <AnimatePresence>
                {active === i && (
                  <motion.span
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className="pointer-events-none absolute z-20 whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-left font-body text-xs text-canvas shadow-float"
                    style={{ bottom: `calc(${(d.hours / MAX) * 100}% + 8px)` }}
                  >
                    <span className="block font-semibold">
                      {d.day} · {fmt(d.hours)} hrs
                    </span>
                    <span className="block opacity-75">
                      {d.hours >= promise ? 'Met the promise' : `${fmt(promise - d.hours)} hrs short`}
                    </span>
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex gap-2 border-t border-line pt-2" aria-hidden="true">
        {days.map((d) => (
          <span key={d.day} className="flex-1 text-center font-body text-xs text-ink-muted">
            {d.day}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>Hours of light per day this week</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row">{d.day}</th>
              <td>{fmt(d.hours)} hours</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
