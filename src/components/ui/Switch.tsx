'use client';

import React, { useId } from 'react';
import { motion } from 'framer-motion';
import { cn } from './cn';

interface SwitchProps {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}

/** On/off setting row: label and hint always visible, the whole row is tappable. */
export function Switch({ label, hint, checked, onChange, icon, disabled }: SwitchProps) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-label`}
      aria-describedby={`${id}-hint`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-canvas disabled:opacity-50"
    >
      {icon && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas text-ink-muted" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span id={`${id}-label`} className="block font-body text-sm font-semibold text-ink">
          {label}
        </span>
        <span id={`${id}-hint`} className="mt-0.5 block font-body text-xs leading-snug text-ink-muted">
          {hint}
        </span>
      </span>
      <span
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-status-restored' : 'bg-line-strong',
        )}
        aria-hidden="true"
      >
        <motion.span
          className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-card"
          initial={false}
          animate={{ left: checked ? 22 : 2 }}
          transition={{ type: 'spring', stiffness: 600, damping: 34 }}
        />
      </span>
    </button>
  );
}
