import React from 'react';
import { ZapOffIcon, ActivityIcon, BatteryLowIcon, CheckIcon, TruckIcon, SparklesIcon } from 'lucide-react';
import {
  incidentColor,
  issueMeta,
  statusMeta,
  type IncidentStatus,
  type IssueType,
} from '@/data/nsukka';
import { cn } from './cn';

export function IssueIcon({ issue, className = 'h-4 w-4' }: { issue: IssueType; className?: string }) {
  const Icon = issue === 'no_power' ? ZapOffIcon : issue === 'low_voltage' ? BatteryLowIcon : ActivityIcon;
  return <Icon className={className} strokeWidth={2.25} aria-hidden="true" />;
}

/** Solid coloured pill: what the problem is. */
export function IssueBadge({ issue, status, className }: { issue: IssueType; status?: IncidentStatus; className?: string }) {
  const restored = status === 'restored';
  return (
    <span
      className={cn('inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 font-body text-xs font-semibold text-white', className)}
      style={{ backgroundColor: incidentColor({ issue, status: status ?? 'reported' }) }}
    >
      {restored ? <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> : <IssueIcon issue={issue} className="h-3.5 w-3.5" />}
      {restored ? 'Restored' : issueMeta[issue].label}
    </span>
  );
}

/** Quiet outline pill: where the fix is. */
export function StatusBadge({ status, className }: { status: IncidentStatus; className?: string }) {
  const meta = statusMeta[status];
  return (
    <span
      className={cn('inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 font-body text-xs font-medium', className)}
      style={{ color: meta.color }}
    >
      {status === 'crew_dispatched' && <TruckIcon className="h-3.5 w-3.5" aria-hidden="true" />}
      {status === 'restored' && <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />}
      {(status === 'reported' || status === 'confirmed') && (
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden="true" />
      )}
      {meta.label}
    </span>
  );
}

export function PredictionBadge({ confidence, className }: { confidence: number; className?: string }) {
  return (
    <span
      className={cn('inline-flex h-7 items-center gap-1.5 rounded-full bg-status-predicted px-2.5 font-body text-xs font-semibold text-white', className)}
    >
      <SparklesIcon className="h-3.5 w-3.5" aria-hidden="true" />
      AI forecast · {confidence}%
    </span>
  );
}
