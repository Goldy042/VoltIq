'use client';

import React, { useState } from 'react';

interface Bar {
  hour: string;
  reports: number;
}

/**
 * Reports received per hour, last 24 hours. Single series, so no legend —
 * the card title names it. Hover or focus a bar for its exact value.
 */
export function ReportsChart({ data }: { data: Bar[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.reports));
  const ceiling = Math.ceil(max / 10) * 10;
  const ticks = [0, ceiling / 2, ceiling];
  const peak = data.reduce((b, d, i) => (d.reports > data[b].reports ? i : b), 0);
  const H = 160;

  return (
    <div>
      <div className="relative flex gap-2">
        <div className="flex flex-col justify-between pb-5 text-right font-body text-2xs tabular-nums text-ink-faint" style={{ height: H + 20 }}>
          {[...ticks].reverse().map((t) => (
            <span key={t} className="-translate-y-1/2 leading-none">
              {t}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {/* recessive grid */}
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: H }}>
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-line" style={{ bottom: (t / ceiling) * H }} />
            ))}
          </div>
          <div className="relative flex items-end gap-[2px]" style={{ height: H }} onMouseLeave={() => setHover(null)}>
            {data.map((d, i) => {
              const h = Math.max(2, (d.reports / ceiling) * H);
              const active = hover === i;
              return (
                <button
                  key={i}
                  type="button"
                  className="group relative flex h-full flex-1 items-end focus:outline-none"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${d.hour}: ${d.reports} reports`}
                >
                  <span
                    className="block w-full rounded-t-[4px] transition-opacity"
                    style={{
                      height: h,
                      backgroundColor: i === data.length - 1 ? 'var(--ink)' : 'var(--accent)',
                      opacity: hover === null || active ? 1 : 0.45,
                    }}
                  />
                  {active && (
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-sm bg-ink px-2 py-1 font-body text-xs text-canvas shadow-float">
                      <span className="font-semibold tabular-nums">{d.reports}</span> reports · {d.hour}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between font-body text-2xs text-ink-faint">
            <span>{data[0].hour} yesterday</span>
            <span className="hidden sm:inline">Peak {data[peak].reports} at {data[peak].hour}</span>
            <span>Now</span>
          </div>
        </div>
      </div>
      <table className="sr-only">
        <caption>Reports per hour</caption>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <th>{d.hour}</th>
              <td>{d.reports}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
