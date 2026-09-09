import React from 'react';

type Variant = 'primary' | 'secondary' | 'quiet';

const base =
'inline-flex items-center justify-center gap-2 font-body text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary:
  'border border-ink bg-ink text-canvas hover:border-accent hover:bg-accent hover:text-accent-on',
  secondary: 'border border-line-strong text-ink hover:border-ink',
  quiet: 'border border-transparent text-ink-muted hover:text-ink'
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'lg';
  full?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  full = false,
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  const sizing = size === 'lg' ? 'px-6 py-4 text-base' : 'px-5 py-3';
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${sizing} ${full ? 'w-full' : ''} ${className}`}
      style={{ borderRadius: 'var(--radius-sm)' }}
      {...props} />);


}