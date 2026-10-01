'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from './cn';

interface ChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
  count?: number;
  icon?: React.ReactNode;
  /** Chips over a map float with a shadow; chips on a page sit flat. */
  floating?: boolean;
}

/** Toggleable filter pill, styled after map apps' top filter rail. */
export function Chip({ label, active, onClick, color, count, icon, floating = false }: ChipProps) {
  return (
    <motion.button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 font-body text-sm font-medium transition-colors duration-150',
        active ? 'bg-ink text-canvas' : 'bg-surface text-ink hover:bg-sunken',
        floating ? 'shadow-float' : !active && 'border border-line',
      )}
    >
      {icon}
      {color && !icon && (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      )}
      {label}
      {count !== undefined && (
        <span className={cn('tabular-nums', active ? 'text-canvas opacity-70' : 'text-ink-faint')}>{count}</span>
      )}
    </motion.button>
  );
}
