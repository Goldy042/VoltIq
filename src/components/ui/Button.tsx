'use client';

import React from 'react';
import Link from 'next/link';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-body font-medium transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-45';

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-canvas hover:opacity-85',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-ink',
  ghost: 'text-ink-muted hover:bg-sunken hover:text-ink',
  danger: 'bg-status-out text-white hover:opacity-90',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-14 px-6 text-base',
};

interface SharedProps {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

export function buttonClass({ variant = 'primary', size = 'md', full = false }: SharedProps = {}) {
  return cn(base, variants[variant], sizes[size], full && 'w-full');
}

interface ButtonProps extends SharedProps, Omit<HTMLMotionProps<'button'>, 'children'> {
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant,
  size,
  full,
  leading,
  trailing,
  loading = false,
  className,
  type = 'button',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClass({ variant, size, full }), className)}
      {...props}
    >
      {loading ? <Spinner /> : leading}
      {children}
      {!loading && trailing}
    </motion.button>
  );
}

interface ButtonLinkProps extends SharedProps {
  href: string;
  className?: string;
  children: React.ReactNode;
}

/** A Next.js link that looks exactly like a Button. */
export function ButtonLink({ href, variant, size, full, leading, trailing, className, children }: ButtonLinkProps) {
  return (
    <Link href={href} className={cn(buttonClass({ variant, size, full }), 'group active:scale-[0.97]', className)}>
      {leading}
      {children}
      {trailing}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)}
    />
  );
}
