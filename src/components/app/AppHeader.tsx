'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { BellIcon, CheckCircle2Icon, MessageSquareIcon, SparklesIcon } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/components/ui/cn';
import { alerts, type Alert } from '@/data/nsukka';
import { useProfile } from '@/lib/profile';

const nav = [
  { href: '/dashboard', label: 'Home' },
  { href: '/map', label: 'Live map' },
  { href: '/report', label: 'Report' },
];

const alertIcon: Record<Alert['kind'], { icon: React.ElementType; color: string }> = {
  prediction: { icon: SparklesIcon, color: 'var(--status-predicted)' },
  update: { icon: MessageSquareIcon, color: 'var(--ink)' },
  restored: { icon: CheckCircle2Icon, color: 'var(--status-restored)' },
};

/** App header; `night` floats over dark heroes, `day` sits on the page. */
export function AppHeader({ tone = 'day' }: { tone?: 'day' | 'night' }) {
  const night = tone === 'night';
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = read ? 0 : alerts.filter((a) => a.unread).length;
  const { profile } = useProfile();
  const initials = profile.name.split(' ').map((p) => p[0]).slice(0, 2).join('');

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <header
      className={cn(
        'sticky top-0 z-30 pt-[env(safe-area-inset-top)] transition-colors duration-300',
        night ? 'bg-[#0b0b0d]' : 'bg-canvas shadow-card',
      )}
    >
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-5">
        <Logo href="/dashboard" inverted={night} />
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {nav.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  'relative rounded-full px-4 py-2 font-body text-sm font-medium transition-colors',
                  night
                    ? active ? 'text-white' : 'text-white/60 hover:text-white'
                    : active ? 'text-ink' : 'text-ink-muted hover:text-ink',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className={cn('absolute inset-0 rounded-full', night ? 'bg-white/10' : 'bg-surface shadow-card')}
                  />
                )}
                <span className="relative">{n.label}</span>
              </Link>
            );
          })}
        </nav>

        <div ref={ref} className="relative ml-auto flex items-center gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            aria-label={`Alerts${unread ? `, ${unread} unread` : ''}`}
            aria-expanded={open}
            onClick={() => {
              setOpen((o) => !o);
              setRead(true);
            }}
            className={cn(
              'relative flex h-11 w-11 items-center justify-center rounded-full transition-colors',
              night ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-sunken text-ink hover:bg-line',
            )}
          >
            <BellIcon className="h-5 w-5" aria-hidden="true" />
            {unread > 0 && (
              <span
                className={cn(
                  'absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-status-out px-1 text-[10px] font-semibold tabular-nums text-white ring-2',
                  night ? 'ring-[#0b0b0d]' : 'ring-canvas',
                )}
              >
                {unread}
              </span>
            )}
          </motion.button>
          <Link
            href="/profile"
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full font-body text-sm font-semibold transition-[colors,transform] active:scale-95',
              night ? 'bg-white text-[#111113]' : 'bg-ink text-canvas',
              pathname === '/profile' && 'ring-2 ring-accent ring-offset-2 ring-offset-canvas',
            )}
            aria-label={`Your profile, ${profile.name}`}
          >
            {initials}
          </Link>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                className="absolute right-0 top-14 w-[min(22rem,calc(100vw-2.5rem))] origin-top-right overflow-hidden rounded-lg bg-surface shadow-float"
                role="dialog"
                aria-label="Alerts"
              >
                <p className="border-b border-line px-4 py-3 font-display text-base font-bold text-ink">Alerts</p>
                <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
                  {alerts.map((a) => {
                    const { icon: Icon, color } = alertIcon[a.kind];
                    return (
                      <li key={a.id} className="flex gap-3 px-4 py-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: color }}>
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-body text-sm font-semibold text-ink">{a.title}</p>
                          <p className="mt-0.5 font-body text-sm leading-snug text-ink-muted">{a.body}</p>
                          <p className="mt-1 font-body text-xs text-ink-faint">{a.when}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
