'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRightIcon, CornerDownLeftIcon, MapPinIcon, SearchIcon, SparklesIcon, UserIcon, UsersIcon } from 'lucide-react';
import { IssueIcon } from '@/components/ui/Badges';
import { cn } from '@/components/ui/cn';
import { areaById, issueMeta, predictions, statusMeta } from '@/data/nsukka';
import { roleMeta } from '@/data/operations';
import { useSharedOutageFeed } from '@/hooks/useOutageFeed';
import { useOperations } from '@/lib/operations';
import { Kbd } from './parts';

export const operatorPages = [
  { href: '/operator', label: 'Overview', key: 'o' },
  { href: '/operator/map', label: 'Live map', key: 'm' },
  { href: '/operator/reports', label: 'Reports', key: 'r' },
  { href: '/operator/teams', label: 'Teams', key: 't' },
  { href: '/operator/staff', label: 'Roles & staff', key: 's' },
] as const;

interface Item {
  id: string;
  group: 'Pages' | 'Faults' | 'Forecasts' | 'Teams' | 'People';
  label: string;
  detail: string;
  href: string;
  icon: React.ReactNode;
  keywords: string;
}

const PaletteContext = createContext<() => void>(() => {});
export const useOpenPalette = () => useContext(PaletteContext);

/**
 * ⌘K / Ctrl+K / "/" opens a jump-anywhere search. "G" then a letter goes
 * straight to a page (G O overview, G M map, G R reports, G T teams, G S staff).
 */
export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const gPressed = useRef(0);

  useEffect(() => {
    const typing = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        setOpen(true);
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'g') {
        gPressed.current = Date.now();
        return;
      }
      if (Date.now() - gPressed.current < 900) {
        const page = operatorPages.find((p) => p.key === key);
        if (page) {
          e.preventDefault();
          router.push(page.href);
        }
        gPressed.current = 0;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  const openPalette = useCallback(() => setOpen(true), []);

  return (
    <PaletteContext.Provider value={openPalette}>
      {children}
      <AnimatePresence>{open && <Palette onClose={() => setOpen(false)} />}</AnimatePresence>
    </PaletteContext.Provider>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { incidents } = useSharedOutageFeed();
  const { teams, staff, leadName } = useOperations();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const items = useMemo<Item[]>(() => {
    const pages: Item[] = operatorPages.map((p) => ({
      id: `page-${p.href}`,
      group: 'Pages',
      label: p.label,
      detail: `G then ${p.key.toUpperCase()}`,
      href: p.href,
      icon: <ArrowRightIcon className="h-4 w-4" />,
      keywords: p.label,
    }));
    const faults: Item[] = incidents
      .filter((i) => i.status !== 'restored')
      .sort((a, b) => b.households - a.households)
      .map((i) => ({
        id: i.id,
        group: 'Faults',
        label: i.place,
        detail: `${issueMeta[i.issue].label} · ${statusMeta[i.status].label} · ${i.reports} reports`,
        href: `/operator/map?focus=${i.id}`,
        icon: <IssueIcon issue={i.issue} className="h-4 w-4" />,
        keywords: `${i.place} ${i.area} ${areaById[i.areaId]?.feeder ?? ''}`,
      }));
    const forecasts: Item[] = predictions.map((p) => ({
      id: p.id,
      group: 'Forecasts',
      label: p.area,
      detail: `${p.confidence}% · ${p.window}`,
      href: `/operator/map?focus=${p.id}`,
      icon: <SparklesIcon className="h-4 w-4" />,
      keywords: `${p.area} forecast prediction`,
    }));
    const teamItems: Item[] = teams.map((t) => ({
      id: t.id,
      group: 'Teams',
      label: t.name,
      detail: `Lead: ${leadName(t.id)} · ${t.zone.join(', ') || 'No feeders'}`,
      href: '/operator/teams',
      icon: <UsersIcon className="h-4 w-4" />,
      keywords: `${t.name} ${leadName(t.id)} ${t.zone.join(' ')}`,
    }));
    const people: Item[] = staff.map((s) => ({
      id: s.id,
      group: 'People',
      label: s.name,
      detail: `${roleMeta[s.role].label}${s.teamId ? ` · ${teams.find((t) => t.id === s.teamId)?.name ?? ''}` : ''}`,
      href: '/operator/staff',
      icon: <UserIcon className="h-4 w-4" />,
      keywords: `${s.name} ${roleMeta[s.role].label}`,
    }));
    const all = [...pages, ...faults, ...forecasts, ...teamItems, ...people];
    const q = query.trim().toLowerCase();
    if (!q) return [...pages, ...faults.slice(0, 5), ...forecasts.slice(0, 2)];
    return all.filter((it) => `${it.label} ${it.keywords}`.toLowerCase().includes(q)).slice(0, 12);
  }, [query, incidents, teams, staff, leadName]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (it: Item | undefined) => {
    if (!it) return;
    onClose();
    router.push(it.href);
  };

  let lastGroup = '';

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-start justify-center px-3 pt-[12vh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
    >
      <button type="button" aria-label="Close search" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 500, damping: 36 }}
        className="relative w-full max-w-xl overflow-hidden rounded-md bg-surface shadow-float"
      >
        <label className="flex h-14 items-center gap-3 border-b border-line px-4">
          <SearchIcon className="h-5 w-5 shrink-0 text-ink-faint" aria-hidden="true" />
          <span className="sr-only">Search faults, forecasts, teams, people and pages</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, items.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                go(items[active]);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder="Search a place, fault, team or person…"
            className="h-full flex-1 bg-transparent font-body text-base text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <Kbd>Esc</Kbd>
        </label>

        <ul ref={listRef} role="listbox" className="max-h-[52vh] overflow-y-auto p-2">
          {items.length === 0 && (
            <li className="px-3 py-10 text-center font-body text-sm text-ink-muted">
              <MapPinIcon className="mx-auto mb-2 h-5 w-5 text-ink-faint" aria-hidden="true" />
              Nothing matches “{query}”.
            </li>
          )}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <React.Fragment key={`${it.group}-${it.id}`}>
                {header && <li className="px-3 pb-1 pt-3 font-mono text-2xs uppercase tracking-wide text-ink-faint first:pt-1">{header}</li>}
                <li
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(it)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5',
                    i === active ? 'bg-raised' : '',
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-canvas text-ink-muted">{it.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-body text-sm font-medium text-ink">{it.label}</span>
                    <span className="block truncate font-body text-xs text-ink-faint">{it.detail}</span>
                  </span>
                  {i === active && <CornerDownLeftIcon className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
        <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 font-body text-xs text-ink-faint">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> move
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> open
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <Kbd>G</Kbd> then <Kbd>M</Kbd> map
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
