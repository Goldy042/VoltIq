'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ChevronsUpDownIcon,
  InboxIcon,
  LayoutDashboardIcon,
  MapIcon,
  SearchIcon,
  ShieldCheckIcon,
  UsersIcon,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/components/ui/cn';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { roleMeta } from '@/data/operations';
import { useSharedOutageFeed } from '@/hooks/useOutageFeed';
import { useOperations } from '@/lib/operations';
import { CommandPaletteProvider, useOpenPalette } from './CommandPalette';
import { LiveDot, ModK, initials } from './parts';
import { useReportLog } from './ReportLog';

export { initials };

const groups = [
  {
    label: 'Operate',
    items: [
      { href: '/operator', label: 'Overview', short: 'Overview', icon: LayoutDashboardIcon, key: 'O' },
      { href: '/operator/map', label: 'Live map', short: 'Map', icon: MapIcon, key: 'M' },
      { href: '/operator/reports', label: 'Reports', short: 'Reports', icon: InboxIcon, key: 'R' },
    ],
  },
  {
    label: 'Organise',
    items: [
      { href: '/operator/teams', label: 'Teams', short: 'Teams', icon: UsersIcon, key: 'T' },
      { href: '/operator/staff', label: 'Roles & staff', short: 'Staff', icon: ShieldCheckIcon, key: 'S' },
    ],
  },
];
const allItems = groups.flatMap((g) => g.items);

/** Wall clock in Nsukka (WAT), rendered only on the client so it never mismatches. */
function useLagosClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(t);
  }, []);
  if (!now) return { time: '--:--', day: '' };
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', ...o }).format(now);
  return { time: fmt({ hour: '2-digit', minute: '2-digit', hour12: false }), day: fmt({ weekday: 'short', day: 'numeric', month: 'short' }) };
}

/**
 * The Control Room: a dark, calm frame around every operator page. Sidebar on
 * desktop, top bar + bottom tabs on phones. ⌘K searches everything.
 */
export function OperatorShell({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="dark" className="bg-canvas text-ink">
      <CommandPaletteProvider>
        <Frame>{children}</Frame>
      </CommandPaletteProvider>
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const openPalette = useOpenPalette();
  const { rows } = useReportLog();
  const { incidents } = useSharedOutageFeed();
  const clock = useLagosClock();
  const pending = rows.filter((r) => r.review === 'pending').length;
  const open = incidents.filter((i) => i.status !== 'restored').length;
  const isMap = pathname === '/operator/map';

  const isActive = (href: string) => (href === '/operator' ? pathname === href : pathname.startsWith(href));
  const current = allItems.find((n) => isActive(n.href)) ?? allItems[0];
  const badge = (href: string) => (href === '/operator/reports' && pending ? pending : undefined);

  return (
    <div className="flex h-dvh flex-col lg:flex-row">
      {/* ---- Sidebar (desktop) ---- */}
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-line px-4">
          <Logo href="/operator" inverted />
        </div>

        <div className="px-3 pt-3">
          <div className="flex items-center gap-2.5 rounded-sm px-2 py-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-raised font-mono text-2xs font-semibold text-ink ring-1 ring-line-strong">
              NS
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-body text-sm font-semibold text-ink">Nsukka district</p>
              <p className="font-body text-2xs text-ink-faint">Enugu Electricity Distribution</p>
            </div>
          </div>

          <button
            type="button"
            onClick={openPalette}
            className="mt-2 flex h-9 w-full items-center gap-2 rounded-sm bg-canvas px-2.5 font-body text-sm text-ink-faint ring-1 ring-line transition-colors hover:text-ink-muted hover:ring-line-strong"
          >
            <SearchIcon className="h-4 w-4" aria-hidden="true" />
            <span className="flex-1 text-left">Search…</span>
            <ModK />
          </button>
        </div>

        <nav aria-label="Operator" className="mt-4 flex flex-col gap-5 px-3">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="px-2 pb-1.5 font-mono text-2xs uppercase tracking-wide text-ink-faint">{g.label}</p>
              <div className="flex flex-col gap-0.5">
                {g.items.map((n) => {
                  const active = isActive(n.href);
                  const count = badge(n.href);
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex h-9 items-center gap-2.5 rounded-sm px-2 font-body text-sm transition-colors',
                        active ? 'text-ink' : 'text-ink-muted hover:bg-raised hover:text-ink',
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="op-nav"
                          className="absolute inset-0 rounded-sm bg-raised ring-1 ring-line-strong"
                          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        />
                      )}
                      {active && <span className="absolute -left-3 top-2 h-5 w-0.5 rounded-full bg-accent" aria-hidden="true" />}
                      <n.icon className="relative h-4 w-4" aria-hidden="true" />
                      <span className="relative flex-1 font-medium">{n.label}</span>
                      {count !== undefined ? (
                        <span className="relative rounded-sm bg-status-low px-1.5 font-mono text-2xs font-semibold leading-5 text-[#09090b]">{count}</span>
                      ) : (
                        <span className="relative hidden font-mono text-[10px] text-ink-faint group-hover:inline">G {n.key}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto space-y-1 border-t border-line p-3">
          <div className="flex items-center justify-between px-2 py-1.5 font-body text-xs">
            <span className="flex items-center gap-2 text-ink-muted">
              <LiveDot />
              Live feed
            </span>
            <span className="font-mono text-ink-faint">
              {clock.day} · <span className="text-ink">{clock.time}</span> WAT
            </span>
          </div>
          <ActingAs />
          <OperatorSignOut className="flex h-9 w-full items-center gap-2.5 rounded-sm px-2 font-body text-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink" iconClassName="h-4 w-4" />
        </div>
      </aside>

      {/* ---- Main column ---- */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 pt-[env(safe-area-inset-top)] lg:px-6">
          <span className="lg:hidden">
            <Logo href="/operator" inverted compact />
          </span>
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 font-body text-sm">
            <span className="hidden text-ink-faint sm:inline">Nsukka</span>
            <span className="hidden text-ink-faint sm:inline" aria-hidden="true">/</span>
            <span className="truncate font-medium text-ink">{current.label}</span>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden h-8 items-center gap-2 rounded-sm px-2.5 font-body text-xs text-ink-muted ring-1 ring-line md:inline-flex">
              <LiveDot color="var(--status-out)" />
              <span className="font-mono text-ink">{open}</span> open faults
            </span>
            {pending > 0 && (
              <Link
                href="/operator/reports"
                className="hidden h-8 items-center gap-2 rounded-sm px-2.5 font-body text-xs text-ink-muted ring-1 ring-line transition-colors hover:text-ink md:inline-flex"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-status-low" aria-hidden="true" />
                <span className="font-mono text-ink">{pending}</span> to review
              </Link>
            )}
            <button
              type="button"
              onClick={openPalette}
              aria-label="Search"
              className="flex h-8 w-8 items-center justify-center rounded-sm text-ink-muted ring-1 ring-line hover:text-ink lg:hidden"
            >
              <SearchIcon className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="lg:hidden">
              <ActingAs compact />
            </span>
            <OperatorSignOut
              iconOnly
              className="flex h-8 w-8 items-center justify-center rounded-sm text-ink-muted ring-1 ring-line hover:text-ink lg:hidden"
              iconClassName="h-4 w-4"
            />
          </div>
        </header>

        {/* `relative` makes this the containing block for absolutely positioned children
            (screen-reader-only labels, chart tooltips). Without it they are placed against
            the page instead, at their position deep inside this scroller, and stretch the
            whole document — a blank strip under the console. */}
        <main className={cn('relative min-h-0 min-w-0 flex-1', isMap ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden')}>
          {children}
        </main>

        {/* Phones: all five sections across the bottom */}
        <nav aria-label="Operator" className="grid shrink-0 grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
          {allItems.map((n) => {
            const active = isActive(n.href);
            const count = badge(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className={cn('relative flex h-14 flex-col items-center justify-center gap-0.5 font-body text-2xs font-medium', active ? 'text-ink' : 'text-ink-faint')}
              >
                {active && <motion.span layoutId="op-tab" className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-accent" />}
                <span className="relative">
                  <n.icon className="h-5 w-5" aria-hidden="true" />
                  {count !== undefined && (
                    <span className="absolute -right-3 -top-1.5 rounded-sm bg-status-low px-1 font-mono text-[9px] font-semibold leading-[14px] text-[#09090b]">
                      {count}
                    </span>
                  )}
                </span>
                {n.short}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/**
 * Demo identity switcher: pick who is using the dashboard to see what each
 * role can do. Replace with the signed-in Clerk user and their role.
 */
function ActingAs({ compact = false }: { compact?: boolean }) {
  const { staff, actingAs, setActingAs, live } = useOperations();
  const office = staff.filter((s) => s.role === 'manager' || s.role === 'dispatcher' || s.role === 'team_lead');
  return (
    <label className={cn('relative flex items-center gap-2.5 rounded-sm', compact ? '' : 'px-2 py-1.5 hover:bg-raised')}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink font-body text-2xs font-semibold text-canvas">
        {initials(actingAs.name)}
      </span>
      {!compact && (
        <span className="min-w-0 flex-1">
          <span className="block truncate font-body text-sm font-medium text-ink">{actingAs.name}</span>
          <span className="block font-body text-xs text-ink-faint">{roleMeta[actingAs.role].label}</span>
        </span>
      )}
      {!compact && !live && <ChevronsUpDownIcon className="h-4 w-4 text-ink-faint" aria-hidden="true" />}
      {!live && (
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
      )}
    </label>
  );
}

/** Only real (signed-in) sessions can sign out; the demo roster has nobody to sign out. */
function OperatorSignOut(props: React.ComponentProps<typeof SignOutButton>) {
  const { live } = useOperations();
  return live ? <SignOutButton {...props} /> : null;
}
