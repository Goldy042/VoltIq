'use client';

import React, { useId } from 'react';
import { motion } from 'framer-motion';
import { cn } from './cn';

interface SegmentedControlProps<T extends string> {
  label: string;
  hint: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}

/** iOS-style segmented switch with a sliding thumb. */
export function SegmentedControl<T extends string>({ label, hint, value, onChange, options }: SegmentedControlProps<T>) {
  const id = useId();
  return (
    <div>
      <p id={`${id}-label`} className="font-body text-sm font-medium text-ink">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        className="mt-2 flex rounded-full bg-sunken p-1"
      >
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              className={cn(
                'relative h-10 flex-1 rounded-full font-body text-sm font-medium transition-colors duration-150',
                selected ? 'text-ink' : 'text-ink-muted hover:text-ink',
              )}
            >
              {selected && (
                <motion.span
                  layoutId={`${id}-thumb`}
                  className="absolute inset-0 rounded-full bg-surface shadow-card"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative">{opt.label}</span>
            </button>
          );
        })}
      </div>
      <p id={`${id}-hint`} className="mt-2 font-body text-xs text-ink-faint">
        {hint}
      </p>
    </div>
  );
}
