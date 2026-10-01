'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, InfoIcon, SparklesIcon, TruckIcon, XIcon } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { IssueIcon } from '@/components/ui/Badges';

const rows: Array<{ swatch: React.ReactNode; label: string; detail: string }> = [
  {
    swatch: <Swatch color="var(--status-out)"><IssueIcon issue="no_power" className="h-3.5 w-3.5" /></Swatch>,
    label: 'No light',
    detail: 'The number is how many neighbours reported it',
  },
  {
    swatch: <Swatch color="var(--status-low)"><IssueIcon issue="low_voltage" className="h-3.5 w-3.5" /></Swatch>,
    label: 'Low or unstable light',
    detail: 'Dim bulbs, or light that keeps going off',
  },
  {
    swatch: <Swatch color="var(--status-crew)"><TruckIcon className="h-3.5 w-3.5" /></Swatch>,
    label: 'Crew on the way',
    detail: 'EEDC has sent a team to fix it',
  },
  {
    swatch: <Swatch color="var(--status-restored)"><CheckIcon className="h-3.5 w-3.5" strokeWidth={3} /></Swatch>,
    label: 'Light restored',
    detail: 'Shown when you zoom in',
  },
  {
    swatch: <Swatch color="var(--status-predicted)"><SparklesIcon className="h-3.5 w-3.5" /></Swatch>,
    label: 'AI forecast',
    detail: 'Dashed zone where an outage may happen',
  },
];

function Swatch({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: color }} aria-hidden="true">
      {children}
    </span>
  );
}

/** "What do the colours mean?" — one tap, so the map never feels like a puzzle. */
export function MapKey() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <IconButton
        floating
        size="lg"
        label={open ? 'Close map key' : 'What do the colours mean?'}
        aria-expanded={open}
        icon={open ? <XIcon className="h-5 w-5" /> : <InfoIcon className="h-5 w-5" />}
        onClick={() => setOpen((o) => !o)}
      />
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Map key"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
            className="absolute bottom-16 right-0 w-[min(19rem,calc(100vw-1.5rem))] origin-bottom-right rounded-lg bg-surface p-4 shadow-float"
          >
            <p className="font-display text-base font-bold text-ink">Map key</p>
            <ul className="mt-3 space-y-3">
              {rows.map((r) => (
                <li key={r.label} className="flex items-start gap-3">
                  {r.swatch}
                  <span>
                    <span className="block font-body text-sm font-semibold text-ink">{r.label}</span>
                    <span className="block font-body text-xs leading-snug text-ink-muted">{r.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-line pt-3 font-body text-xs leading-snug text-ink-faint">
              White pins group nearby areas. Tap one to zoom in.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
