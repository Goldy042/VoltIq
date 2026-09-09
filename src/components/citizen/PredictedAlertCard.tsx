import React from 'react';
import { XIcon } from 'lucide-react';
import { predictedAlert } from '../../data/citizen';

interface PredictedAlertCardProps {
  onDismiss?: () => void;
}

/** Prediction warning — distinguished by the predicted status token and a heavy left rule. */
export function PredictedAlertCard({ onDismiss }: PredictedAlertCardProps) {
  const color = 'var(--status-predicted)';

  return (
    <aside
      aria-label="Predicted outage warning"
      className="relative border border-line bg-surface"
      style={{ borderRadius: 'var(--radius-sm)', borderLeft: `3px solid ${color}` }}>
      
      <div className="px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span
              className="h-[7px] w-[7px] rounded-full"
              style={{ backgroundColor: color, animation: 'grid-pulse 2.6s linear infinite' }}
              aria-hidden="true" />
            
            <p className="font-body text-2xs uppercase tracking-wide" style={{ color }}>
              Predicted outage · {predictedAlert.confidence}% confidence
            </p>
          </div>
          {onDismiss &&
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss prediction warning"
            className="-m-1 p-1 text-ink-faint transition-colors duration-150 ease-out hover:text-ink">
            
              <XIcon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          }
        </div>

        <p className="mt-4 max-w-[28ch] font-display text-xl font-medium leading-snug tracking-tight text-ink sm:text-2xl">
          Possible outage {predictedAlert.window}
        </p>
        <p className="mt-3 max-w-[52ch] font-body text-sm leading-body text-ink-muted">
          {predictedAlert.body}
        </p>

        <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body text-2xs uppercase tracking-wide text-ink-faint">
            {predictedAlert.area}
          </p>
          <p className="font-body text-xs text-ink-muted">{predictedAlert.advice}</p>
        </div>
      </div>
    </aside>);

}