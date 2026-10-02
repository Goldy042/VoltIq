'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronDownIcon, InboxIcon, LayoutDashboardIcon, MapIcon, ShieldCheckIcon, UsersIcon } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/components/ui/cn';
import { roleMeta } from '@/data/operations';
import { useOperations } from '@/lib/operations';
import { useReportLog } from './ReportLog';

const nav = [
  { href: '/operator', label: 'Overview', icon: LayoutDashboardIcon },
  { href: '/operator/map', label: 'Live map', icon: MapIcon },
  { href: '/operator/reports', label: 'Reports', icon: InboxIcon },
  { href: '/operator/teams', label: 'Teams', icon: UsersIcon },
  { href: '/operator/staff', label: 'Roles & staff', icon: ShieldCheckIcon },
];

export const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

/** Sidebar on desktop, a scrolling tab row on phones. */
export function OperatorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { rows } = useReportLog();
  const pending = rows.filter((r) => r.review === 'pending').length;
  const isMap = pathname === '/operator/map';

  const links = nav.map((n) => {
    const active = n.href === '/operator' ? pathname === n.href : pathname.startsWith(n.href);
    return { ...n, active, badge: n.href === '/operator/reports' && pending ? pending : undefined };
  });

  return (
    <div className="flex h-dvh flex-col bg-canvas lg:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center gap-2 px-5">
          <Logo href="/operator" />
        </div>
        <p className="px-5 pb-2 font-body text-2xs font-semibold uppercase tracking-wide text-ink-faint">EEDC Nsukka</p>
        <nav aria-label="Operator" className="flex flex-col gap-0.5 px-3">
          {links.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={n.active ? 'page' : undefined}
              className={cn(
                'relative flex h-10 items-center gap-3 rounded-md px-3 font-body text-sm font-medium transition-colors',
                n.active ? 'text-ink' : 'text-ink-muted hover:bg-sunken hover:text-ink',
              )}
            >
              {n.active && <motion.span layoutId="op-nav" className="absolute inset-0 rounded-md bg-sunken" />}
              <n.icon className="relative h-4 w-4" aria-hidden="true" />
              <span className="relative flex-1">{n.label}</span>
              {n.badge !== undefined && (
                <span className="relative rounded-full bg-status-out px-1.5 py-0.5 font-body text-2xs font-semibold tabular-nums text-white">
                  {n.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-line p-3">
          <ActingAs />
        </div>
      </aside>

      <header className="shrink-0 border-b border-line bg-surface pt-[env(safe-area-inset-top)] lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Logo href="/operator" />
          <ActingAs compact />
        </div>
        <nav aria-label="Operator" className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2">
          {links.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={n.active ? 'page' : undefined}
              className={cn(
                'flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 font-body text-sm font-medium',
                n.active ? 'bg-ink text-canvas' : 'text-ink-muted hover:bg-sunken',
              )}
            >
              <n.icon className="h-4 w-4" aria-hidden="true" />
              {n.label}
              {n.badge !== undefined && <span className="tabular-nums opacity-70">{n.badge}</span>}
            </Link>
          ))}
        </nav>
      </header>

      <main className={cn('min-h-0 min-w-0 flex-1', isMap ? 'relative overflow-hidden' : 'overflow-y-auto')}>{children}</main>
    </div>
  );
}

/**
 * Demo identity switcher: pick who is using the dashboard to see what each
 * role can do. Replace with the signed-in Clerk user and their role.
 */
function ActingAs({ compact = false }: { compact?: boolean }) {
  const { staff, actingAs, setActingAs } = useOperations();
  const office = staff.filter((s) => s.role === 'manager' || s.role === 'dispatcher' || s.role === 'team_lead');
  return (
    <label className={cn('relative flex items-center gap-2.5 rounded-md', compact ? '' : 'p-2 hover:bg-sunken')}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink font-body text-xs font-semibold text-canvas">
        {initials(actingAs.name)}
      </span>
      {!compact && (
        <span className="min-w-0 flex-1">
          <span className="block truncate font-body text-sm font-semibold text-ink">{actingAs.name}</span>
          <span className="block font-body text-xs text-ink-muted">{roleMeta[actingAs.role].label}</span>
        </span>
      )}
      {!compact && <ChevronDownIcon className="h-4 w-4 text-ink-faint" aria-hidden="true" />}
      <select
        aria-label="Viewing the dashboard as"
        value={actingAs.id}
        onChange={(e) => setActingAs(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {office.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} — {roleMeta[s.role].label}
          </option>
        ))}
      </select>
    </label>
  );
}
