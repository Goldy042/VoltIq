'use client';

import React from 'react';
import { FieldShell, controlClass, type FieldProps } from './Field';
import { cn } from './cn';

interface TextAreaProps
  extends FieldProps,
    Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {}

export function TextArea({ label, hint, error, optional, className, rows = 3, ...props }: TextAreaProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} className={className}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(controlClass(invalid), 'resize-none px-4 py-3 leading-body')}
          {...props}
        />
      )}
    </FieldShell>
  );
}
