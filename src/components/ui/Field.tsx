'use client';

import React, { useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircleIcon } from 'lucide-react';
import { cn } from './cn';

export interface FieldProps {
  /** Visible label. Always shown — never replaced by the placeholder. */
  label: string;
  /** Helper text under the control. Always provided so every field explains itself. */
  hint: string;
  error?: string;
  optional?: boolean;
  className?: string;
}

interface FieldShellProps extends FieldProps {
  children: (ids: { id: string; describedBy: string; invalid: boolean }) => React.ReactNode;
}

/** Label + control + hint/error wrapper shared by every form control. */
export function FieldShell({ label, hint, error, optional, className, children }: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={className}>
      <label htmlFor={id} className="flex items-baseline justify-between gap-3 font-body text-sm font-medium text-ink">
        {label}
        {optional && <span className="font-normal text-ink-faint">Optional</span>}
      </label>
      <div className="mt-2">{children({ id, describedBy: hintId, invalid: Boolean(error) })}</div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={error ? 'error' : 'hint'}
          id={hintId}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16 }}
          role={error ? 'alert' : undefined}
          className={cn(
            'mt-2 flex items-start gap-1.5 font-body text-xs leading-snug',
            error ? 'text-status-out' : 'text-ink-faint',
          )}
        >
          {error && <AlertCircleIcon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          {error ?? hint}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/** Shared visual for text-like controls. 16px text stops iOS zooming on focus. */
export const controlClass = (invalid: boolean) =>
  cn(
    'w-full rounded-md border bg-surface font-body text-base text-ink placeholder:text-ink-faint',
    'transition-[border-color,box-shadow] duration-150 ease-out focus:outline-none',
    invalid
      ? 'border-status-out focus:shadow-[0_0_0_4px_rgb(229_56_59/0.15)]'
      : 'border-line-strong hover:border-ink-faint focus:border-accent focus:shadow-[0_0_0_4px_var(--accent-tint)]',
  );
