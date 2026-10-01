'use client';

import React, { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRightIcon, CheckIcon, SearchIcon, SparklesIcon, TruckIcon, XIcon } from 'lucide-react';
import { IssueIcon } from '@/components/ui/Badges';
import { cn } from '@/components/ui/cn';
import { areas, crews, incidents, issueMeta, predictions, type Area } from '@/data/nsukka';
import { formatAgo } from '@/lib/geo';

interface AreaSearchProps {
  onPick: (area: Area | null) => void;
}

/** "Is there light in my area?" — answers the question people arrive with. */
export function AreaSearch({ onPick }: AreaSearchProps) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<Area | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? areas.filter((a) => a.name.toLowerCase().includes(q) || a.feeder.toLowerCase().includes(q)) : areas;
    return list.slice(0, 6);
  }, [query]);

  const pick = (area: Area) => {
    setPicked(area);
    setQuery(area.name);
    setOpen(false);
    onPick(area);
  };

  const clear = () => {
    setPicked(null);
    setQuery('');
    onPick(null);
  };

  return (
    <div className="relative w-full max-w-md">
      <label htmlFor={`${id}-input`} className="font-body text-sm font-semibold text-white">
        Is there light in your area?
      </label>
      <div className="relative mt-2">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/50" aria-hidden="true" />
        <input
          id={`${id}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-describedby={`${id}-hint`}
          aria-activedescendant={open && matches[active] ? `${id}-opt-${matches[active].id}` : undefined}
          autoComplete="off"
          value={query}
          placeholder="Type your area, e.g. Odenigwe or Hilltop"
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
            if (picked) {
              setPicked(null);
              onPick(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, matches.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && open && matches[active]) {
              e.preventDefault();
              pick(matches[active]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          className="h-14 w-full rounded-full border border-white/15 bg-[#17181b] pl-12 pr-12 font-body text-base text-white placeholder:text-white/45 transition-[border-color,box-shadow] focus:border-white/50 focus:shadow-[0_0_0_4px_rgb(255_255_255/0.08)] focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear area"
            className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <XIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        <AnimatePresence>
          {open && !picked && matches.length > 0 && (
            <motion.ul
              id={`${id}-list`}
              role="listbox"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-x-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-lg border border-white/10 bg-[#17181b] py-1.5"
            >
              {matches.map((a, i) => {
                const live = incidents.find((x) => x.areaId === a.id && x.status !== 'restored');
                return (
                  <li
                    key={a.id}
                    id={`${id}-opt-${a.id}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(a)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 font-body text-sm text-white',
                      i === active && 'bg-white/10',
                    )}
                  >
                    {a.name}
                    {live && (
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: issueMeta[live.issue].color }} aria-hidden="true" />
                    )}
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
      <p id={`${id}-hint`} className="mt-2 font-body text-xs text-white/55">
        Live reports from neighbours and EEDC crews across Nsukka.
      </p>

      <AnimatePresence mode="wait">{picked && <Answer key={picked.id} area={picked} />}</AnimatePresence>
    </div>
  );
}

function Answer({ area }: { area: Area }) {
  const live = incidents.find((i) => i.areaId === area.id && i.status !== 'restored');
  const restored = incidents.find((i) => i.areaId === area.id && i.status === 'restored');
  const forecast = predictions.find((p) => p.areaId === area.id || p.area.includes(area.name));
  const crew = live?.crewId ? crews.find((c) => c.id === live.crewId) : undefined;

  const color = live ? issueMeta[live.issue].color : 'var(--status-restored)';
  const title = live
    ? live.issue === 'no_power'
      ? `No light in ${area.name}`
      : live.issue === 'low_voltage'
        ? `Low voltage in ${area.name}`
        : `Light is unstable in ${area.name}`
    : `Light is on in ${area.name}`;
  const detail = live
    ? `${live.reports} neighbours reported · since ${formatAgo(live.minutesAgo)}`
    : restored
      ? 'Restored earlier tonight'
      : 'No reports in the last hour';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className="mt-4 rounded-lg bg-[#f3f3f0] p-4 text-[#111113]"
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: color }}>
          {live ? <IssueIcon issue={live.issue} className="h-5 w-5" /> : <CheckIcon className="h-5 w-5" strokeWidth={3} aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-snug tracking-tight">{title}</p>
          <p className="mt-0.5 font-body text-sm text-[#55575d]">{detail}</p>
          {crew && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 font-body text-sm font-medium text-[#2457f5]">
              <TruckIcon className="h-4 w-4" aria-hidden="true" />
              {crew.name} {crew.status === 'on_site' ? 'is on site' : `is about ${crew.etaMinutes ?? 5} min away`}
            </p>
          )}
          {forecast && (
            <p className="mt-1.5 inline-flex items-start gap-1.5 font-body text-sm font-medium text-[#7457ea]">
              <SparklesIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              AI: possible {issueMeta[forecast.issue].label.toLowerCase()} {forecast.window.toLowerCase()} ({forecast.confidence}%)
            </p>
          )}
        </div>
      </div>
      <Link
        href={live ? `/map?focus=${live.id}` : forecast ? `/map?focus=${forecast.id}` : '/map'}
        className="group mt-3 flex items-center justify-between rounded-md bg-[#111113] px-4 py-3 font-body text-sm font-semibold text-white"
      >
        {live ? 'See it on the live map' : 'Open the live map'}
        <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </motion.div>
  );
}
