'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/** Number that rolls up when it changes — makes live counts feel live. */
export function AnimatedCount({ value, className }: { value: number | string; className?: string }) {
  return (
    <span className={`relative inline-flex overflow-hidden tabular-nums ${className ?? ''}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 34 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
