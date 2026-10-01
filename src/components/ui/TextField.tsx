'use client';

import React from 'react';
import { FieldShell, controlClass, type FieldProps } from './Field';
import { cn } from './cn';

interface TextFieldProps
  extends FieldProps,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

export function TextField({ label, hint, error, optional, className, leading, trailing, ...props }: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          {leading && (
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">
              {leading}
            </span>
          )}
          <input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn(controlClass(invalid), 'h-12', leading ? 'pl-11' : 'pl-4', trailing ? 'pr-28' : 'pr-4')}
            {...props}
          />
          {trailing && <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</span>}
        </div>
      )}
    </FieldShell>
  );
}
