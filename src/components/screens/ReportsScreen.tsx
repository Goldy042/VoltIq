'use client';

import React from 'react';
import { PlusIcon } from 'lucide-react';
import { AppHeader } from '@/components/app/AppHeader';
import { AppTabBar } from '@/components/app/AppTabBar';
import { MyReportsList } from '@/components/dashboard/MyReportsList';
import { ButtonLink } from '@/components/ui/Button';
import { useMyReports } from '@/hooks/useMyReports';

/** Every report the resident has made, with what happened to each. */
export function ReportsScreen() {
  const { reports, loaded, failed, withdraw } = useMyReports();
  const open = reports.filter((r) => r.canWithdraw).length;

  return (
    <div className="min-h-dvh bg-canvas pb-28 lg:pb-16">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 pt-6 lg:px-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Your reports</h1>
            <p className="mt-1 font-body text-sm text-ink-muted">
              {loaded && reports.length
                ? `${reports.length} report${reports.length === 1 ? '' : 's'}${open ? ` · ${open} still open` : ''}`
                : 'Everything you’ve reported, and what EEDC did about it.'}
            </p>
          </div>
          <ButtonLink href="/report" size="sm" leading={<PlusIcon className="h-4 w-4" aria-hidden="true" />}>
            New report
          </ButtonLink>
        </div>

        <section className="mt-5 rounded-xl bg-surface p-5 shadow-card">
          {!loaded ? (
            <p className="font-body text-sm text-ink-muted">Loading your reports…</p>
          ) : reports.length === 0 ? (
            <div className="py-6 text-center">
              <p className="font-body text-sm font-semibold text-ink">{failed ? 'Couldn’t load your reports' : 'No reports yet'}</p>
              <p className="mx-auto mt-1 max-w-xs font-body text-sm text-ink-muted">
                {failed ? 'Check your connection and open this page again.' : 'When your light goes or the voltage drops, report it here and follow the repair.'}
              </p>
            </div>
          ) : (
            <MyReportsList reports={reports} onWithdraw={withdraw} />
          )}
        </section>
      </main>
      <AppTabBar />
    </div>
  );
}
