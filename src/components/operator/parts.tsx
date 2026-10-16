'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { TruckIcon } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { AnimatedCount } from '@/components/ui/AnimatedCount';
import { healthMeta, type HealthLevel } from '@/data/operations';
import { IssueIcon } from '@/components/ui/Badges';
import { issueMeta, type IssueType } from '@/data/nsukka';

/*
 * Control Room primitives. Calm graphite panels with hairline edges; colour
 * appears only where something needs a decision. Numbers are monospaced so
 * columns of figures line up and live counts don't jitter.
 */

export const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

const ease = [0.23, 1, 0.32, 1] as const;

export function Page({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn('mx-auto w-full space-y-5 px-4 pb-12 pt-5 lg:px-6 lg:pb-16 lg:pt-6', wide ? 'max-w-[1600px]' : 'max-w-[1280px]')}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease }}
      className="flex flex-wrap items-end justify-between gap-3"
    >
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 font-mono text-2xs uppercase tracking-wide text-ink-faint">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-[70ch] font-body text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}

/** A titled panel. `flush` removes body padding for tables and maps. */
export function Panel({
  title,
  meta,
  action,
  className,
  bodyClassName,
  flush = false,
  delay = 0,
  children,
}: {
  title?: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease }}
      className={cn('flex min-w-0 flex-col overflow-hidden rounded-md bg-surface shadow-card', className)}
    >
      {(title || action || meta) && (
        <header className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-4">
          <div className="flex min-w-0 items-baseline gap-2">
            {title && <h2 className="truncate font-body text-sm font-semibold text-ink">{title}</h2>}
            {meta && <span className="shrink-0 font-mono text-2xs text-ink-faint">{meta}</span>}
          </div>
          {action}
        </header>
      )}
      <div className={cn('min-h-0 flex-1', !flush && 'p-4', bodyClassName)}>{children}</div>
    </motion.section>
  );
}

/** Older name, kept so every page shares the same panel. */
export function Card({ title, action, className, children }: { title?: React.ReactNode; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <Panel title={title} action={action} className={className}>
      {children}
    </Panel>
  );
}

/** Tiny trend line, no axes: shape only. Values carry their own label. */
export function Sparkline({ data, color = 'var(--accent)', className }: { data: number[]; color?: string; className?: string }) {
  if (data.length < 2) return null;
  const w = 100;
  const h = 28;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const y = (v: number) => h - 2 - ((v - min) / (max - min || 1)) * (h - 4);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${y(v)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn('h-7 w-full', className)} aria-hidden="true">
      <motion.polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease }}
      />
      <circle cx={w} cy={y(data[data.length - 1])} r={2.5} fill={color} />
    </svg>
  );
}

export interface KpiItem {
  label: string;
  value: number | string;
  hint?: React.ReactNode;
  /** Status colour for the dot; omit for neutral metrics. */
  tone?: string;
  spark?: number[];
}

/** One strip, many numbers, hairline dividers — reads as a single instrument. */
export function KpiStrip({ items }: { items: KpiItem[] }) {
  return (
    <motion.dl
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease }}
      className="grid grid-cols-2 overflow-hidden rounded-md bg-surface shadow-card sm:grid-cols-3 xl:grid-cols-6"
    >
      {items.map((k, i) => (
        <div
          key={k.label}
          className={cn(
            'flex min-w-0 flex-col justify-between gap-2 border-line p-4',
            // Hairlines between cells, whatever the column count.
            'border-b border-r',
            i % 2 === 1 && 'max-sm:border-r-0',
          )}
        >
          <dt className="flex items-center gap-1.5 font-body text-xs font-medium text-ink-muted">
            {k.tone && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: k.tone }} aria-hidden="true" />}
            <span className="truncate">{k.label}</span>
          </dt>
          <dd className="font-mono text-[28px] font-medium leading-none tracking-tight text-ink">
            <AnimatedCount value={k.value} />
          </dd>
          {k.spark ? <Sparkline data={k.spark} color={k.tone ?? 'var(--accent)'} /> : <span className="h-7" aria-hidden="true" />}
          {k.hint && <dd className="-mt-1 truncate font-body text-xs text-ink-faint">{k.hint}</dd>}
        </div>
      ))}
    </motion.dl>
  );
}

/** Kept for pages that show a single figure. */
export function Kpi({ label, value, hint, color }: { label: string; value: number | string; hint?: React.ReactNode; icon?: React.ReactNode; color?: string }) {
  return <KpiStrip items={[{ label, value, hint, tone: color }]} />;
}

export function LiveDot({ color = 'var(--status-restored)', className }: { color?: string; className?: string }) {
  return (
    <span className={cn('relative flex h-2 w-2 shrink-0', className)} aria-hidden="true">
      <span className="animate-pulse-ring absolute inset-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="relative h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

/** Soft status chip: tinted fill, coloured text — readable on graphite. */
export function Tag({ color, children, className }: { color: string; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn('inline-flex h-6 shrink-0 items-center gap-1.5 rounded-sm px-2 font-body text-xs font-medium', className)}
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {children}
    </span>
  );
}

export function HealthBadge({ level, score }: { level: HealthLevel; score?: number }) {
  const meta = healthMeta[level];
  return (
    <Tag color={meta.color}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden="true" />
      {meta.label}
      {score !== undefined && <span className="font-mono tabular-nums opacity-80">{score}</span>}
    </Tag>
  );
}

/**
 * Whether a team has a job, from the dispatches made on this dashboard. We
 * don't know where a team physically is, so this never says "en route".
 */
export function JobStatus({ place, href }: { place?: string; href?: string }) {
  if (!place) {
    return (
      <Tag color="var(--ink-muted)">
        <span className="h-1.5 w-1.5 rounded-full bg-status-restored" aria-hidden="true" />
        Free
      </Tag>
    );
  }
  const pill = (
    <Tag color="var(--status-crew)" className="max-w-full">
      <TruckIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{place}</span>
    </Tag>
  );
  return href ? (
    <Link href={href} className="min-w-0 max-w-full hover:opacity-85">
      {pill}
    </Link>
  ) : (
    pill
  );
}

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-raised font-body font-semibold text-ink ring-1 ring-line-strong',
        size === 'sm' ? 'h-7 w-7 text-2xs' : 'h-9 w-9 text-xs',
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/** Filter toggle used in table toolbars. */
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
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm px-2.5 font-body text-xs font-medium transition-colors',
        active ? 'bg-raised text-ink ring-1 ring-line-strong' : 'text-ink-muted hover:bg-raised hover:text-ink',
      )}
    >
      {label}
      {count !== undefined && <span className="font-mono tabular-nums text-ink-faint">{count}</span>}
    </button>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line-strong bg-raised px-1 font-mono text-[10px] font-medium text-ink-muted">
      {children}
    </kbd>
  );
}

/** "⌘K" on Apple devices, "Ctrl K" everywhere else. Decided on the client. */
export function ModK() {
  const [mac, setMac] = React.useState(true);
  React.useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)), []);
  return <Kbd>{mac ? '⌘K' : 'Ctrl K'}</Kbd>;
}

/** Issue chip for dense tables: tinted, so a page of them stays calm. */
export function IssueTag({ issue }: { issue: IssueType }) {
  return (
    <Tag color={issueMeta[issue].color}>
      <IssueIcon issue={issue} className="h-3 w-3" />
      {issueMeta[issue].label}
    </Tag>
  );
}
