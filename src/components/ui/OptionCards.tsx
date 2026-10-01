'use client';

import React, { useId } from 'react';
import { motion } from 'framer-motion';
import { CheckIcon } from 'lucide-react';
import { cn } from './cn';

export interface Option<T extends string> {
  value: T;
  label: string;
  description: string;
  icon?: React.ReactNode;
  /** CSS colour used for the icon tile and selected ring. */
  color?: string;
}

interface OptionCardsProps<T extends string> {
  label: string;
  hint: string;
  value: T | null;
  onChange: (value: T) => void;
  options: Option<T>[];
  columns?: 1 | 2 | 3;
  error?: string;
}

/** Large tappable radio cards — easier on a phone than a dropdown. */
export function OptionCards<T extends string>({
  label,
  hint,
  value,
  onChange,
  options,
  columns = 1,
  error,
}: OptionCardsProps<T>) {
  const id = useId();
  return (
    <fieldset aria-describedby={`${id}-hint`}>
      <legend className="font-body text-sm font-medium text-ink">{label}</legend>
      <p id={`${id}-hint`} className={cn('mt-1 font-body text-xs', error ? 'text-status-out' : 'text-ink-faint')}>
        {error ?? hint}
      </p>
      <div
        role="radiogroup"
        className={cn(
          'mt-3 grid gap-2.5',
          columns === 2 && 'sm:grid-cols-2',
          columns === 3 && 'grid-cols-1 sm:grid-cols-3',
        )}
      >
        {options.map((opt) => {
          const selected = value === opt.value;
          const color = opt.color ?? 'var(--ink)';
          return (
            <motion.button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'relative flex w-full items-center gap-4 rounded-lg border bg-surface p-4 text-left transition-[border-color,box-shadow] duration-150',
                selected ? 'border-transparent' : 'border-line hover:border-line-strong',
              )}
              style={selected ? { boxShadow: `0 0 0 2px ${color}` } : undefined}
            >
              {opt.icon && (
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white"
                  style={{ backgroundColor: color }}
                >
                  {opt.icon}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-display text-base font-semibold tracking-tight text-ink">{opt.label}</span>
                <span className="mt-0.5 block font-body text-sm leading-snug text-ink-muted">{opt.description}</span>
              </span>
              <motion.span
                initial={false}
                animate={{ scale: selected ? 1 : 0.6, opacity: selected ? 1 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              >
                <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />
              </motion.span>
            </motion.button>
          );
        })}
      </div>
    </fieldset>
  );
}
