import React from 'react';
import { feederReadings, statusLabels, statusVars } from '../data/gridFeed';

const DOTS = 34;

/**
 * Restrained live-data visual: one thin line of pulsing dots per feeder,
 * colored by outage status, with a slow sweep reading across the grid.
 */
export function GridSignal() {
  return (
    <section
      aria-label="Live grid signal"
      className="border border-line bg-surface"
      style={{ borderRadius: 'var(--radius-sm)' }}>
      
      <div className="flex items-baseline justify-between border-b border-line px-6 py-3">
        <span className="font-body text-2xs uppercase tracking-wide text-ink-faint">
          Live grid signal
        </span>
        <span className="font-body text-2xs tabular-nums text-ink-faint">
          Updated 14s ago
        </span>
      </div>

      <ul className="divide-y divide-line">
        {feederReadings.map((reading, rowIndex) => {
          const color = statusVars[reading.status];
          const litUntil = Math.round(DOTS * reading.load);

          return (
            <li key={reading.id} className="px-6 py-5">
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-display text-sm font-medium text-ink">
                  {reading.feeder}
                  <span className="ml-2 font-body font-normal text-ink-faint">
                    {reading.district}
                  </span>
                </p>
                <p
                  className="font-body text-2xs uppercase tracking-wide"
                  style={{ color }}>
                  
                  {statusLabels[reading.status]}
                </p>
              </div>

              <div
                className="relative mt-3 flex h-3 items-center gap-[3px] overflow-hidden"
                aria-hidden="true">
                
                {Array.from({ length: DOTS }).map((_, i) => {
                  const lit = i < litUntil;
                  return (
                    <span
                      key={i}
                      className="h-[3px] w-[3px] shrink-0 rounded-full"
                      style={{
                        backgroundColor: lit ? color : 'var(--line-strong)',
                        opacity: lit ? 0.28 : 0.5,
                        animation: lit ?
                        `grid-pulse 2.4s linear ${
                        (i * 0.055 + rowIndex * 0.3).toFixed(2)}s infinite` :

                        undefined
                      }} />);


                })}
                <span
                  className="pointer-events-none absolute inset-y-0 left-0 w-[2px]"
                  style={{
                    backgroundColor: color,
                    opacity: 0.35,
                    animation: `sweep 9s linear ${rowIndex * 0.8}s infinite`
                  }} />
                
              </div>

              <p className="mt-2 font-body text-xs text-ink-muted">
                {reading.detail}
              </p>
            </li>);

        })}
      </ul>
    </section>);

}