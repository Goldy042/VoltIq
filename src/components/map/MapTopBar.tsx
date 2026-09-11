import React from 'react';
import Link from 'next/link';
import { SearchIcon, XIcon } from 'lucide-react';

interface MapTopBarProps {
  view: 'citizen' | 'operator';
  query: string;
  onQuery: (value: string) => void;
  showReports: boolean;
  showPredictions: boolean;
  onToggleReports: () => void;
  onTogglePredictions: () => void;
  activeCount: number;
}

function LayerToggle({
  label,
  color,
  active,
  onClick





}: {label: string;color: string;active: boolean;onClick: () => void;}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex items-center gap-2 border px-3 py-2 font-body text-xs transition-colors duration-150 ease-out"
      style={{
        borderRadius: 'var(--radius-sm)',
        borderColor: active ? 'var(--ink)' : 'var(--line-strong)',
        color: active ? 'var(--ink)' : 'var(--ink-faint)'
      }}>
      
      <span
        className="h-[6px] w-[6px] rounded-full"
        style={{ backgroundColor: color, opacity: active ? 1 : 0.35 }}
        aria-hidden="true" />
      
      {label}
    </button>);

}

export function MapTopBar({
  view,
  query,
  onQuery,
  showReports,
  showPredictions,
  onToggleReports,
  onTogglePredictions,
  activeCount
}: MapTopBarProps) {
  return (
    <header className="z-30 w-full border-b border-line bg-canvas">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:flex-nowrap md:px-6">
        <Link
          href="/"
          className="font-display text-base font-semibold tracking-tight text-ink transition-colors duration-150 ease-out hover:text-accent">
          
          Gridpulse<span className="text-accent">.</span>
        </Link>

        <span className="hidden font-body text-2xs uppercase tracking-wide text-ink-faint lg:inline">
          {view === 'operator' ? 'Operations · Bellhaven' : 'Live map · Bellhaven'}
        </span>

        <div className="order-last w-full md:order-none md:ml-6 md:w-72">
          <div
            className="flex items-center gap-2 border border-line-strong bg-surface px-3"
            style={{ borderRadius: 'var(--radius-sm)' }}>
            
            <SearchIcon
              className="h-4 w-4 shrink-0 text-ink-faint"
              strokeWidth={1.5}
              aria-hidden="true" />
            
            <label htmlFor="map-search" className="sr-only">
              Search streets, districts or feeders
            </label>
            <input
              id="map-search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Street, district or feeder"
              className="w-full bg-transparent py-2 font-body text-sm text-ink placeholder:text-ink-faint focus:outline-none" />
            
            {query &&
            <button
              type="button"
              onClick={() => onQuery('')}
              aria-label="Clear search"
              className="p-1 text-ink-faint transition-colors duration-150 ease-out hover:text-ink">
              
                <XIcon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              </button>
            }
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <LayerToggle
            label="Live reports"
            color="var(--status-reported)"
            active={showReports}
            onClick={onToggleReports} />
          
          <LayerToggle
            label="AI predictions"
            color="var(--status-predicted)"
            active={showPredictions}
            onClick={onTogglePredictions} />
          

          <span className="ml-2 hidden font-body text-2xs uppercase tracking-wide tabular-nums text-ink-faint xl:inline">
            {activeCount} active
          </span>

          <Link
            href={view === 'operator' ? '/map' : '/operations'}
            className="ml-2 hidden border border-line-strong px-3 py-2 font-body text-xs text-ink-muted transition-colors duration-150 ease-out hover:border-ink hover:text-ink sm:inline-block"
            style={{ borderRadius: 'var(--radius-sm)' }}>
            
            {view === 'operator' ? 'Citizen view' : 'Operator view'}
          </Link>
        </div>
      </div>
    </header>);

}