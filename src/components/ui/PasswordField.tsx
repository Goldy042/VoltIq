'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { TextField } from './TextField';

interface PasswordFieldProps {
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: 'current-password' | 'new-password';
  /** Show a strength meter under the field (sign-up). */
  meter?: boolean;
}

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/\d/.test(pw) && /[a-z]/i.test(pw)) s++;
  if (/[^a-z0-9]/i.test(pw) || /[A-Z]/.test(pw)) s++;
  return s;
}

const levels = [
  { label: 'Too short', color: 'var(--line-strong)' },
  { label: 'Weak', color: 'var(--status-out)' },
  { label: 'Okay', color: 'var(--status-low)' },
  { label: 'Good', color: 'var(--status-restored)' },
  { label: 'Strong', color: 'var(--status-restored)' },
];

export function PasswordField({ label, hint, placeholder, value, onChange, error, autoComplete, meter = false }: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  const s = strength(value);
  return (
    <div>
      <TextField
        label={label}
        hint={hint}
        placeholder={placeholder}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        error={error}
        onChange={(e) => onChange(e.target.value)}
        trailing={
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-faint hover:bg-sunken hover:text-ink"
          >
            {show ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
        }
      />
      {meter && value && (
        <div className="mt-2 flex items-center gap-3" aria-live="polite">
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                <motion.span
                  className="block h-full rounded-full"
                  initial={false}
                  animate={{ width: i <= s ? '100%' : '0%', backgroundColor: levels[s].color }}
                  transition={{ duration: 0.25 }}
                />
              </span>
            ))}
          </div>
          <span className="w-16 text-right font-body text-xs font-medium text-ink-muted">{levels[s].label}</span>
        </div>
      )}
    </div>
  );
}
