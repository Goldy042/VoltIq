'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ToastInput {
  title: string;
  body?: string;
  icon?: React.ReactNode;
  /** Tone colour for the icon tile. */
  color?: string;
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((t: ToastInput) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-2), { ...t, id }]);
    window.setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), t.duration ?? 3800);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[2000] flex flex-col items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),12px)]"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg bg-surface p-3 pr-4 shadow-float"
            >
              {t.icon && (
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: t.color ?? 'var(--ink)' }}
                >
                  {t.icon}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate font-body text-sm font-semibold text-ink">{t.title}</span>
                {t.body && <span className="block truncate font-body text-xs text-ink-muted">{t.body}</span>}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
