'use client';

import React from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { FieldShell, controlClass, type FieldProps } from './Field';
import { cn } from './cn';

interface SelectProps
  extends FieldProps,
    Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  options: Array<{ value: string; label: string }>;
  /** Shown as a disabled first option until something is chosen. */
  placeholder?: string;
}

export function Select({ label, hint, error, optional, className, options, placeholder, ...props }: SelectProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <select
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn(controlClass(invalid), 'h-12 appearance-none pl-4 pr-10', !props.value && 'text-ink-faint')}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((o) => (
              <option key={o.value} value={o.value} className="text-ink">
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon
            className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            aria-hidden="true"
          />
        </div>
      )}
    </FieldShell>
  );
}
