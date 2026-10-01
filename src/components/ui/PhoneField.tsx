'use client';

import React from 'react';
import { TextField } from './TextField';

interface PhoneFieldProps {
  label: string;
  hint: string;
  value: string;
  onChange: (digits: string) => void;
  error?: string;
  autoFocus?: boolean;
  optional?: boolean;
}

/** Group a local number as "803 000 0000" while typing. */
function format(digits: string) {
  const d = digits.slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(' ');
}

/** Normalise "0803…", "+234803…" or "234803…" to the 10 digits after +234. */
export function toLocalDigits(input: string) {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('234')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
}

export const isNigerianMobile = (digits: string) => /^[789][01]\d{8}$/.test(digits);

/** Nigerian mobile number with a fixed +234 prefix. */
export function PhoneField({ label, hint, value, onChange, error, autoFocus, optional }: PhoneFieldProps) {
  return (
    <TextField
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      autoFocus={autoFocus}
      placeholder="803 000 0000"
      value={format(value)}
      onChange={(e) => onChange(toLocalDigits(e.target.value))}
      leading={
        <span className="flex items-center gap-3 font-body text-base font-medium text-ink">
          +234
          <span className="h-5 w-px bg-line-strong" aria-hidden="true" />
        </span>
      }
      className="[&_input]:pl-[5.5rem]"
    />
  );
}
