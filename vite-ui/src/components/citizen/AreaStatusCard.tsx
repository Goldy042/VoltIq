import React from 'react';
import { statusLabels, statusVars } from '../../data/gridFeed';
import { areaStatus, citizenProfile } from '../../data/citizen';

export function AreaStatusCard() {
  const color = statusVars[areaStatus.status];

  return (
    <section
      aria-labelledby="area-status-heading"
      className="border border-line bg-surface"
      style={{ borderRadius: 'var(--radius-sm)' }}>
      
      <div className="flex items-baseline justify-between border-b border-line px-5 py-3">
        <h2
          id="area-status-heading"
          className="font-body text-2xs uppercase tracking-wide text-ink-faint">
          
          Your area status
        </h2>
        <span className="font-body text-2xs tabular-nums text-ink-faint">
          {areaStatus.updated}
        </span>
      </div>

      <div className="px-5 py-6">
        <div className="flex items-center gap-3">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: color, animation: 'grid-pulse 2.6s linear infinite' }}
            aria-hidden="true" />
          
          <p className="font-body text-2xs uppercase tracking-wide" style={{ color }}>
            {statusLabels[areaStatus.status]}
          </p>
        </div>

        <p className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight text-ink">
          {areaStatus.headline}
        </p>
        <p className="mt-3 max-w-[42ch] font-body text-sm leading-body text-ink-muted">
          {areaStatus.detail}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-4">
          <div>
            <dt className="font-body text-2xs uppercase tracking-wide text-ink-faint">
              Address
            </dt>
            <dd className="mt-1 font-body text-sm text-ink">{citizenProfile.address}</dd>
          </div>
          <div>
            <dt className="font-body text-2xs uppercase tracking-wide text-ink-faint">
              Feeder
            </dt>
            <dd className="mt-1 font-body text-sm text-ink">{citizenProfile.feeder}</dd>
          </div>
        </dl>
      </div>
    </section>);

}