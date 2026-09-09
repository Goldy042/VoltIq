import React from 'react';

const entries = [
{
  label: 'Reported',
  detail: 'Citizen reports, fault unconfirmed',
  color: 'var(--status-reported)'
},
{
  label: 'Critical',
  detail: 'Confirmed fault or many reports',
  color: 'var(--status-critical)'
},
{
  label: 'Predicted',
  detail: 'Shaded zone, no outage yet',
  color: 'var(--status-predicted)'
},
{
  label: 'Resolved',
  detail: 'Supply restored in the last 24h',
  color: 'var(--status-stable)'
}];


export function MapLegend() {
  return (
    <div
      className="pointer-events-auto hidden border border-line bg-surface/95 px-4 py-3 backdrop-blur-none md:block"
      style={{ borderRadius: 'var(--radius-sm)' }}>
      
      <p className="font-body text-2xs uppercase tracking-wide text-ink-faint">
        Legend
      </p>
      <ul className="mt-3 space-y-2">
        {entries.map((entry) =>
        <li key={entry.label} className="flex items-baseline gap-3">
            <span
            className="mt-1 h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ backgroundColor: entry.color }}
            aria-hidden="true" />
          
            <span>
              <span className="font-body text-xs text-ink">{entry.label}</span>
              <span className="ml-2 font-body text-2xs text-ink-faint">
                {entry.detail}
              </span>
            </span>
          </li>
        )}
        <li className="flex items-baseline gap-3 border-t border-line pt-2">
          <span
            className="mt-1 flex h-[14px] w-[18px] shrink-0 items-center justify-center border font-display text-[9px] tabular-nums"
            style={{
              borderColor: 'var(--status-critical)',
              color: 'var(--status-critical)',
              borderRadius: 'var(--radius-sm)'
            }}
            aria-hidden="true">
            
            12
          </span>
          <span className="font-body text-2xs text-ink-faint">
            Merged reports in one area, weighted by count
          </span>
        </li>
      </ul>
    </div>);

}