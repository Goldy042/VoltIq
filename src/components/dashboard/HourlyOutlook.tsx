'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ActivityIcon, LightbulbIcon, LightbulbOffIcon } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import type { HourOutlook } from '@/data/nsukka';

interface HourlyOutlookProps {
  hours: HourOutlook[];
  headline: string;
  detail: string;
}

/** Risk tiers: one hue, light → dark, never a rainbow. */
const tier = (risk: number) => (risk >= 60 ? 'high' : risk >= 30 ? 'medium' : 'low');
const fill = { high: 'var(--status-predicted)', medium: '#b6a6f6', low: 'var(--line-strong)' };

/**
 * Like a rain forecast, but for light: the chance of an outage for each of
 * the next 24 hours.
 */
export function HourlyOutlook({ hours, headline, detail }: HourlyOutlookProps) {
  const [active, setActive] = useState<number | null>(null);
  const shown = active !== null ? hours[active] : null;

  return (
    <section aria-labelledby="outlook-title" className="rounded-xl bg-surface p-5 shadow-card lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-faint">Next 24 hours</p>
          <h2 id="outlook-title" className="mt-1 font-display text-xl font-bold tracking-tight text-ink">
            {headline}
          </h2>
          <p className="mt-0.5 font-body text-sm text-ink-muted">{detail}</p>
        </div>
        <p className="h-5 font-body text-sm tabular-nums text-ink-muted" aria-live="polite">
          {shown && (shown.risk === null ? `${shown.label}: unstable right now` : `${shown.label}: ${shown.risk}% chance of no light`)}
        </p>
      </div>

      <div className="no-scrollbar -mx-5 mt-5 overflow-x-auto px-5 lg:-mx-6 lg:px-6">
        <ol className="flex min-w-max items-end gap-1.5" aria-label="Chance of losing light, hour by hour">
          {hours.map((h, i) => {
            const now = h.risk === null;
            const t = now ? null : tier(h.risk!);
            const Icon = now ? ActivityIcon : t === 'high' ? LightbulbOffIcon : LightbulbIcon;
            return (
              <li key={h.label}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive(i)}
                  aria-label={now ? 'Now: light is unstable' : `${h.label}: ${h.risk}% chance of no light`}
                  className={cn(
                    'flex w-12 flex-col items-center gap-2 rounded-md py-2 transition-colors',
                    active === i ? 'bg-canvas' : 'hover:bg-canvas',
                  )}
                >
                  <span className={cn('font-body text-xs', now ? 'font-bold text-ink' : 'text-ink-muted')}>{h.label}</span>
                  <Icon
                    className={cn(
                      'h-5 w-5',
                      now ? 'animate-flicker text-status-low' : t === 'high' ? 'text-status-predicted' : 'text-ink-faint',
                    )}
                    aria-hidden="true"
                  />
                  <span className="relative flex h-20 w-2.5 items-end overflow-hidden rounded-full bg-canvas">
                    <motion.span
                      className="block w-full rounded-full"
                      style={{ backgroundColor: now ? 'var(--status-low)' : fill[t!] }}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${now ? 100 : Math.max(6, h.risk!)}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: 0.1 + i * 0.025, ease: [0.23, 1, 0.32, 1] }}
                    />
                  </span>
                  <span
                    className={cn(
                      'h-4 font-body text-xs tabular-nums',
                      t === 'high' ? 'font-semibold text-ink' : 'text-ink-faint',
                    )}
                  >
                    {now ? '' : h.risk! >= 25 ? `${h.risk}%` : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Same data as a table for screen readers */}
      <table className="sr-only">
        <caption>Chance of losing light in the next 24 hours</caption>
        <tbody>
          {hours.map((h) => (
            <tr key={h.label}>
              <th scope="row">{h.label}</th>
              <td>{h.risk === null ? 'Unstable now' : `${h.risk}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
