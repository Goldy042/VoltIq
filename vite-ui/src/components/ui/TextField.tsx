import React from 'react';

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  trailing?: React.ReactNode;
}

export function TextField({
  label,
  hint,
  error,
  trailing,
  id,
  className = '',
  ...props
}: TextFieldProps) {
  const fieldId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

  return (
    <div className={className}>
      <label
        htmlFor={fieldId}
        className="block font-body text-2xs uppercase tracking-wide text-ink-faint">
        
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={fieldId}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className="w-full border-b bg-transparent px-0 py-3 font-body text-base text-ink placeholder:text-ink-faint focus:outline-none"
          style={{
            borderColor: error ? 'var(--status-critical)' : 'var(--line-strong)',
            paddingRight: trailing ? '5.5rem' : undefined
          }}
          {...props} />
        
        {trailing &&
        <div className="absolute right-0 top-1/2 -translate-y-1/2">{trailing}</div>
        }
      </div>
      {error ?
      <p
        id={`${fieldId}-error`}
        className="mt-2 font-body text-xs"
        style={{ color: 'var(--status-critical)' }}>
        
          {error}
        </p> :
      hint ?
      <p id={`${fieldId}-hint`} className="mt-2 font-body text-xs text-ink-faint">
          {hint}
        </p> :
      null}
    </div>);

}