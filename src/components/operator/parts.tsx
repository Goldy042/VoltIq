'use client';

import React from 'react';
import { TruckIcon } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { AnimatedCount } from '@/components/ui/AnimatedCount';
import { crewStatusLabel, type CrewStatus } from '@/data/nsukka';
import { healthMeta, type HealthLevel } from '@/data/operations';
import { initials } from './OperatorShell';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 font-body text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 lg:px-8 lg:py-8">{children}</div>;
}

export function Card({
  title,
  action,
  className,
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('min-w-0 rounded-lg bg-surface p-4 shadow-card lg:p-5', className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-base font-bold tracking-tight text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({
  label,
  value,
  hint,
  icon,
  color = 'var(--ink)',
}: {
  label: string;
  value: number | string;
  hint?: React.ReactNode;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="rounded-lg bg-surface p-4 shadow-card">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ backgroundColor: color }}>
          {icon}
        </span>
        <p className="font-body text-xs font-medium text-ink-muted">{label}</p>
      </div>
      <p className="mt-3 font-display text-3xl font-bold leading-none tracking-tight text-ink tabular-nums">
        <AnimatedCount value={value} />
      </p>
      {hint && <p className="mt-1.5 font-body text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

export function HealthBadge({ level, score }: { level: HealthLevel; score?: number }) {
  const meta = healthMeta[level];
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-line bg-surface px-2 font-body text-xs font-medium text-ink">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden="true" />
      {meta.label}
      {score !== undefined && <span className="tabular-nums text-ink-faint">{score}</span>}
    </span>
  );
}

const crewColor: Record<CrewStatus, string> = {
  available: 'var(--status-restored)',
  en_route: 'var(--status-crew)',
  on_site: 'var(--status-low)',
};

export function CrewStatusPill({ status }: { status: CrewStatus }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full px-2 font-body text-xs font-semibold text-white" style={{ backgroundColor: crewColor[status] }}>
      {status !== 'available' && <TruckIcon className="h-3 w-3" aria-hidden="true" />}
      {crewStatusLabel[status]}
    </span>
  );
}

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-sunken font-body font-semibold text-ink',
        size === 'sm' ? 'h-7 w-7 text-2xs' : 'h-9 w-9 text-xs',
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/** Small filter pill used above tables. */
export function FilterPill({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 font-body text-sm font-medium transition-colors',
        active ? 'bg-ink text-canvas' : 'bg-surface text-ink-muted shadow-card hover:text-ink',
      )}
    >
      {label}
      {count !== undefined && <span className="tabular-nums opacity-70">{count}</span>}
    </button>
  );
}
