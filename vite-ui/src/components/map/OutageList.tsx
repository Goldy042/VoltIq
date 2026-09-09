import React from 'react';
import {
  stateColors,
  stateLabels,
  type OutagePoint,
  type PredictedZone } from
'../../data/outages';

interface OutageListProps {
  items: Array<OutagePoint | PredictedZone>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const age = (minutes: number) =>
minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} hr ago`;

export function OutageList({ items, selectedId, onSelect }: OutageListProps) {
  if (items.length === 0) {
    return (
      <p className="px-5 py-10 font-body text-sm text-ink-muted">
        Nothing matches that search on the layers you have on.
      </p>);

  }

  return (
    <ul className="divide-y divide-line">
      {items.map((item) => {
        const prediction = item.kind === 'prediction';
        const color = prediction ? 'var(--status-predicted)' : stateColors[item.state];
        const selected = item.id === selectedId;

        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={selected}
              className="w-full px-5 py-4 text-left transition-colors duration-150 ease-out hover:bg-sunken"
              style={{ backgroundColor: selected ? 'var(--surface-sunken)' : undefined }}>
              
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-baseline gap-3">
                  <span
                    className="h-[7px] w-[7px] shrink-0 translate-y-[-1px] rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden="true" />
                  
                  <span className="truncate font-display text-base font-medium tracking-tight text-ink">
                    {prediction ? `${item.district} · ${item.feeder}` : item.address}
                  </span>
                </span>
                <span className="shrink-0 font-body text-2xs tabular-nums text-ink-faint">
                  {prediction ? `${item.confidence}%` : age(item.ageMinutes)}
                </span>
              </div>

              <p className="mt-1.5 pl-[19px] font-body text-2xs uppercase tracking-wide" style={{ color }}>
                {prediction ? `Predicted · ${item.window}` : stateLabels[item.state]}
                <span className="ml-3 normal-case tracking-normal text-ink-faint">
                  {prediction ?
                  `${item.households} homes at risk` :
                  `${item.reports} reports · ${item.households} homes`}
                </span>
              </p>
            </button>
          </li>);

      })}
    </ul>);

}