'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Logo } from '@/components/ui/Logo';

/** Calm full-page message for "not found" and "something broke". */
export function StatusPage({
  code,
  title,
  body,
  actions,
}: {
  code: string;
  title: string;
  body: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas px-5 pt-[env(safe-area-inset-top)]">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center">
        <Logo href="/" />
      </header>
      <main className="flex flex-1 items-center justify-center pb-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
          className="max-w-md text-center"
        >
          <p className="font-mono text-sm text-ink-faint">{code}</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
          <div className="mt-3 font-body text-base leading-body text-ink-muted">{body}</div>
          <div className="mt-8 flex flex-col justify-center gap-2.5 sm:flex-row">{actions}</div>
        </motion.div>
      </main>
    </div>
  );
}
