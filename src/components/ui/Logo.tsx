import React from 'react';
import Link from 'next/link';
import { ZapIcon } from 'lucide-react';
import { cn } from './cn';

interface LogoProps {
  href?: string;
  className?: string;
  compact?: boolean;
  /** Light-on-dark version for night surfaces. */
  inverted?: boolean;
}

export function Logo({ href = '/', className, compact = false, inverted = false }: LogoProps) {
  return (
    <Link href={href} className={cn('group inline-flex items-center gap-2', className)} aria-label="VoltIq home">
      <span
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-sm transition-[transform,background-color] duration-200 ease-out group-hover:-rotate-6',
          inverted ? 'bg-white/10' : 'bg-ink',
        )}
      >
        <ZapIcon className="h-4 w-4 fill-volt text-volt" aria-hidden="true" />
      </span>
      {!compact && (
        <span className={cn('font-display text-lg font-bold tracking-tight transition-colors duration-200', inverted ? 'text-white' : 'text-ink')}>
          VoltIq
        </span>
      )}
    </Link>
  );
}
