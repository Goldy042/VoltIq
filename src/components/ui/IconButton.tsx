'use client';

import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from './cn';

interface IconButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  /** Accessible name — required because the button has no visible text. */
  label: string;
  icon: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Floating buttons sit over the map with an elevated shadow. */
  floating?: boolean;
  badge?: number;
}

const sizes = { sm: 'h-9 w-9', md: 'h-11 w-11', lg: 'h-14 w-14' };

export function IconButton({ label, icon, size = 'md', floating = false, badge, className, ...props }: IconButtonProps) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full text-ink transition-colors duration-150',
        sizes[size],
        floating ? 'bg-surface shadow-float hover:bg-sunken' : 'bg-sunken hover:bg-line',
        className,
      )}
      {...props}
    >
      {icon}
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-status-out px-1 text-[10px] font-semibold tabular-nums text-white ring-2 ring-surface">
          {badge}
        </span>
      ) : null}
    </motion.button>
  );
}
