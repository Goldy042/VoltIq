import React from 'react';
import { mapIncidents } from '../data/mapData';
import { statusLabels, statusVars } from '../data/gridFeed';

interface OutageMapProps {
  /** Height utility classes for the map frame. */
  className?: string;
  showLegend?: boolean;
}

/** Minimal mock of the live outage map: hairline grid, feeder lines, status pins. */
export function OutageMap({ className = 'h-[420px]', showLegend = true }: OutageMapProps) {
  return (
    <div className="border border-line bg-surface" style={{ borderRadius: 'var(--radius-sm)' }}>
      <div className="flex items-baseline justify-between border-b border-line px-6 py-3">
        <span className="font-body text-2xs uppercase tracking-wide text-ink-faint">
          Bellhaven County · distribution network
        </span>
        <span className="font-body text-2xs tabular-nums text-ink-faint">
          41 feeders · 5 flagged
        </span>
      </div>

      <div className={`relative w-full overflow-hidden bg-sunken ${className}`}>
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true">
          
          {Array.from({ length: 11 }).map((_, i) =>
          <line
            key={`v-${i}`}
            x1={i * 10}
            y1="0"
            x2={i * 10}
            y2="100"
            stroke="var(--line)"
            strokeWidth="0.15" />

          )}
          {Array.from({ length: 11 }).map((_, i) =>
          <line
            key={`h-${i}`}
            x1="0"
            y1={i * 10}
            x2="100"
            y2={i * 10}
            stroke="var(--line)"
            strokeWidth="0.15" />

          )}
          <path
            d="M4 78 L22 60 L26 34 L44 26 L58 22 L74 30"
            fill="none"
            stroke="var(--line-strong)"
            strokeWidth="0.4" />
          
          <path
            d="M15 62 L34 66 L39 71 L56 68 L71 58 L88 52"
            fill="none"
            stroke="var(--line-strong)"
            strokeWidth="0.4" />
          
          <path
            d="M26 34 L34 66"
            fill="none"
            stroke="var(--line-strong)"
            strokeWidth="0.3"
            strokeDasharray="1.5 1.5" />
          
        </svg>

        <ul className="absolute inset-0">
          {mapIncidents.map((incident) => {
            const color = statusVars[incident.status];
            return (
              <li
                key={incident.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${incident.x}%`, top: `${incident.y}%` }}>
                
                <span className="relative flex items-center">
                  <span
                    className="absolute h-4 w-4 -translate-x-1/2 rounded-full"
                    style={{
                      backgroundColor: color,
                      opacity: 0.18,
                      animation:
                      incident.status === 'stable' ?
                      undefined :
                      'grid-pulse 2.6s linear infinite'
                    }} />
                  
                  <span
                    className="relative h-[7px] w-[7px] -translate-x-1/2 rounded-full"
                    style={{ backgroundColor: color }} />
                  
                  <span className="ml-3 whitespace-nowrap font-body text-2xs text-ink-muted">
                    {incident.label}
                  </span>
                </span>
              </li>);

          })}
        </ul>
      </div>

      {showLegend &&
      <ul className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-line px-6 py-3">
          {(Object.keys(statusLabels) as Array<keyof typeof statusLabels>).map((key) =>
        <li key={key} className="flex items-center gap-2">
              <span
            className="h-[6px] w-[6px] rounded-full"
            style={{ backgroundColor: statusVars[key] }}
            aria-hidden="true" />
          
              <span className="font-body text-2xs uppercase tracking-wide text-ink-faint">
                {statusLabels[key]}
              </span>
            </li>
        )}
        </ul>
      }
    </div>);

}