import React from 'react';
import { XIcon } from 'lucide-react';
import {
  stateLabels,
  stateColors,
  type OutagePoint,
  type OutageState,
  type PredictedZone } from
'../../data/outages';

interface OutageDetailProps {
  item: OutagePoint | PredictedZone;
  view: 'citizen' | 'operator';
  onChangeState: (id: string, state: OutageState) => void;
  onClose: () => void;
}

const flow: OutageState[] = ['reported', 'dispatched', 'resolved'];

export function OutageDetail({ item, view, onChangeState, onClose }: OutageDetailProps) {
  const isPrediction = item.kind === 'prediction';
  const color = isPrediction ? 'var(--status-predicted)' : stateColors[item.state];

  return (
    <article
      className="border-b border-line bg-surface px-5 py-5"
      style={{ borderLeft: `3px solid ${color}` }}>
      
      <div className="flex items-start justify-between gap-4">
        <p className="font-body text-2xs uppercase tracking-wide" style={{ color }}>
          {isPrediction ?
          `Predicted · ${item.confidence}% confidence` :
          stateLabels[item.state]}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="-m-1 p-1 text-ink-faint transition-colors duration-150 ease-out hover:text-ink">
          
          <XIcon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      <h2 className="mt-3 font-display text-xl font-medium leading-snug tracking-tight text-ink">
        {isPrediction ? `${item.district} · ${item.feeder}` : item.address}
      </h2>

      <p className="mt-2 max-w-[46ch] font-body text-sm leading-body text-ink-muted">
        {isPrediction ? item.reason : item.note}
      </p>

      <dl className="mt-4 divide-y divide-line border-y border-line font-body text-sm">
        {isPrediction ?
        <>
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-ink-faint">Window</dt>
              <dd className="text-right text-ink">{item.window}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-ink-faint">Homes at risk</dt>
              <dd className="text-right tabular-nums text-ink">{item.households}</dd>
            </div>
          </> :

        <>
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-ink-faint">Reports</dt>
              <dd className="text-right tabular-nums text-ink">{item.reports}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-ink-faint">Homes affected</dt>
              <dd className="text-right tabular-nums text-ink">{item.households}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-ink-faint">Started</dt>
              <dd className="text-right tabular-nums text-ink">
                {item.startedAt} · {item.feeder}
              </dd>
            </div>
            {item.crew &&
          <div className="flex justify-between gap-4 py-2">
                <dt className="text-ink-faint">Crew</dt>
                <dd className="text-right text-ink">{item.crew}</dd>
              </div>
          }
          </>
        }
      </dl>

      {view === 'operator' && !isPrediction &&
      <div className="mt-5">
          {item.state === 'critical' &&
        <button
          type="button"
          onClick={() => onChangeState(item.id, 'dispatched')}
          className="w-full border border-ink bg-ink px-5 py-3 font-body text-sm font-medium text-canvas transition-colors duration-150 ease-out hover:border-accent hover:bg-accent hover:text-accent-on"
          style={{ borderRadius: 'var(--radius-sm)' }}>
          
              Dispatch team
            </button>
        }

          <p className="mt-4 font-body text-2xs uppercase tracking-wide text-ink-faint">
            Change status
          </p>
          <div
          className="mt-2 flex overflow-hidden border border-line-strong"
          style={{ borderRadius: 'var(--radius-sm)' }}
          role="group"
          aria-label="Outage status">
          
            {flow.map((state, i) => {
            const active =
            item.state === state ||
            state === 'reported' && item.state === 'critical';
            return (
              <button
                key={state}
                type="button"
                aria-pressed={active}
                onClick={() => onChangeState(item.id, state)}
                className={`flex-1 px-3 py-2 font-body text-xs transition-colors duration-150 ease-out ${
                i > 0 ? 'border-l border-line-strong' : ''}`
                }
                style={{
                  backgroundColor: active ? 'var(--surface-sunken)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-muted)'
                }}>
                
                  {stateLabels[state]}
                </button>);

          })}
          </div>
        </div>
      }

      {view === 'citizen' && !isPrediction && item.state !== 'resolved' &&
      <p className="mt-5 font-body text-xs leading-body text-ink-faint">
          {item.crew ?
        `${item.crew} is assigned to this fault. You'll be notified when supply returns.` :
        'Reports here are still being confirmed against grid telemetry.'}
        </p>
      }
    </article>);

}