'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftIcon, SearchIcon, XIcon } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import { IssueIcon } from '@/components/ui/Badges';
import { issueMeta } from '@/data/nsukka';
import type { FeedEvent } from '@/hooks/useOutageFeed';

export type MapFilter = 'all' | 'no_power' | 'unstable' | 'forecast' | 'restored';

interface MapTopBarProps {
  query: string;
  onQuery: (q: string) => void;
  filter: MapFilter;
  onFilter: (f: MapFilter) => void;
  counts: Record<MapFilter, number>;
  lastEvent: FeedEvent | null;
  backHref: string;
}

export function MapTopBar({ query, onQuery, filter, onFilter, counts, lastEvent, backHref }: MapTopBarProps) {
  // The ticker announces a new report, then gets out of the way.
  const [ticker, setTicker] = useState<FeedEvent | null>(null);
  useEffect(() => {
    if (!lastEvent) return;
    setTicker(lastEvent);
    const t = window.setTimeout(() => setTicker(null), 4500);
    return () => window.clearTimeout(t);
  }, [lastEvent]);

  const chips: Array<{ value: MapFilter; label: string; color?: string }> = [
    { value: 'all', label: 'All' },
    { value: 'no_power', label: 'No light', color: 'var(--status-out)' },
    { value: 'unstable', label: 'Low / unstable', color: 'var(--status-low)' },
    { value: 'forecast', label: 'AI forecast', color: 'var(--status-predicted)' },
    { value: 'restored', label: 'Restored', color: 'var(--status-restored)' },
  ];

  return (
    <div className="pointer-events-none flex flex-col gap-2.5 pt-[max(env(safe-area-inset-top),12px)]">
      <div className="pointer-events-auto flex items-center gap-2 px-3">
        <Link
          href={backHref}
          aria-label="Back"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface shadow-float transition-transform active:scale-95"
        >
          <ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
        </Link>
        <label className="relative flex h-12 min-w-0 flex-1 items-center rounded-full bg-surface shadow-float lg:max-w-md">
          <span className="sr-only">Search an area, street or feeder in Nsukka</span>
          <SearchIcon className="pointer-events-none absolute left-4 h-5 w-5 text-ink-faint" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search Odenigwe, Hilltop, Ogige…"
            className="h-full w-full rounded-full bg-transparent pl-12 pr-11 font-body text-base text-ink placeholder:text-ink-faint focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQuery('')}
              aria-label="Clear search"
              className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full bg-sunken text-ink-muted"
            >
              <XIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </label>
      </div>

      <div className="no-scrollbar pointer-events-auto -my-2 flex gap-2 overflow-x-auto px-3 py-2">
        {chips.map((c) => (
          <Chip
            key={c.value}
            floating
            label={c.label}
            color={c.color}
            count={c.value === 'all' ? undefined : counts[c.value]}
            active={filter === c.value}
            onClick={() => onFilter(c.value)}
          />
        ))}
      </div>

      {/* Live ticker: a neighbour just reported — proof you're not the only one */}
      <div className="flex h-9 px-3">
        <AnimatePresence mode="popLayout">
          {ticker && (
            <motion.div
              key={ticker.key}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-ink py-1.5 pl-1.5 pr-3.5 text-canvas shadow-float"
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: issueMeta[ticker.issue].color }}
              >
                <IssueIcon issue={ticker.issue} className="h-3.5 w-3.5" />
              </span>
              <span className="truncate font-body text-xs">
                <span className="font-semibold">{ticker.name}</span> reported{' '}
                {issueMeta[ticker.issue].label.toLowerCase()} · {ticker.place}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
