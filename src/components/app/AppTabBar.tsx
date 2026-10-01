'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HomeIcon, MapIcon, PlusIcon } from 'lucide-react';
import { cn } from '@/components/ui/cn';

/** Mobile bottom navigation; the report action is raised and always in thumb reach. */
export function AppTabBar() {
  const pathname = usePathname();
  const tab = (href: string, label: string, Icon: React.ElementType) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex flex-1 flex-col items-center gap-1 py-2 font-body text-[11px] font-medium transition-colors',
          active ? 'text-ink' : 'text-ink-faint',
        )}
      >
        <Icon className="h-6 w-6" strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
        {label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="mx-auto flex max-w-md items-end px-6">
        {tab('/dashboard', 'Home', HomeIcon)}
        <div className="flex flex-1 justify-center">
          <Link
            href="/report"
            aria-label="Report a problem"
            className="-mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-ink text-canvas shadow-float ring-4 ring-canvas transition-transform active:scale-95"
          >
            <PlusIcon className="h-7 w-7" strokeWidth={2.25} aria-hidden="true" />
          </Link>
        </div>
        {tab('/map', 'Live map', MapIcon)}
      </div>
    </nav>
  );
}
