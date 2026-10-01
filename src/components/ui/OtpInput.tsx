'use client';

import React, { useEffect, useId, useRef } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { cn } from './cn';

interface OtpInputProps {
  label: string;
  hint: string;
  value: string;
  onChange: (code: string) => void;
  /** Called once all digits are filled. */
  onComplete?: (code: string) => void;
  error?: string;
  length?: number;
}

/** One box per digit: auto-advances, accepts paste, and browsers can autofill it. */
export function OtpInput({ label, hint, value, onChange, onComplete, error, length = 6 }: OtpInputProps) {
  const id = useId();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const shake = useAnimationControls();
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (error) void shake.start({ x: [0, -8, 8, -6, 6, -3, 0], transition: { duration: 0.4 } });
  }, [error, shake]);

  const setAt = (i: number, d: string) => {
    const next = (value.slice(0, i) + d + value.slice(i + 1)).slice(0, length);
    onChange(next);
    if (next.length === length && !next.includes(' ')) onComplete?.(next);
  };

  return (
    <fieldset aria-describedby={`${id}-hint`}>
      <legend className="font-body text-sm font-medium text-ink">{label}</legend>
      <motion.div animate={shake} className="mt-3 flex gap-2 sm:gap-2.5">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            aria-label={`Digit ${i + 1} of ${length}`}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={length}
            value={d}
            placeholder="·"
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, '');
              if (!raw) return;
              if (raw.length > 1) {
                // Pasted or autofilled the whole code.
                const code = raw.slice(0, length);
                onChange(code);
                refs.current[Math.min(code.length, length - 1)]?.focus();
                if (code.length === length) onComplete?.(code);
                return;
              }
              setAt(i, raw);
              refs.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace') {
                e.preventDefault();
                if (d) setAt(i, '');
                else if (i > 0) {
                  onChange(value.slice(0, i - 1));
                  refs.current[i - 1]?.focus();
                }
              } else if (e.key === 'ArrowLeft') refs.current[i - 1]?.focus();
              else if (e.key === 'ArrowRight') refs.current[i + 1]?.focus();
            }}
            className={cn(
              'h-14 w-full min-w-0 rounded-md border bg-surface text-center font-display text-2xl font-bold tabular-nums text-ink placeholder:text-line-strong',
              'transition-[border-color,box-shadow] focus:outline-none',
              error
                ? 'border-status-out'
                : d
                  ? 'border-ink'
                  : 'border-line-strong focus:border-accent focus:shadow-[0_0_0_4px_var(--accent-tint)]',
            )}
          />
        ))}
      </motion.div>
      <p id={`${id}-hint`} role={error ? 'alert' : undefined} className={cn('mt-2 font-body text-xs', error ? 'text-status-out' : 'text-ink-faint')}>
        {error ?? hint}
      </p>
    </fieldset>
  );
}
