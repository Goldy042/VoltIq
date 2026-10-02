'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, DownloadIcon, GaugeIcon, MapPinIcon, SearchIcon, XIcon } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { IssueBadge, StatusBadge } from '@/components/ui/Badges';
import { cn } from '@/components/ui/cn';
import { useToast } from '@/components/ui/Toast';
import { areas, areaById, type IssueType } from '@/data/nsukka';
import type { ReportReview, ReportRow } from '@/data/operations';
import { describeLocation } from '@/lib/address';
import { formatAgo } from '@/lib/geo';
import { useOperations } from '@/lib/operations';
import { FilterPill, Page, PageHeader } from './parts';
import { useReportLog } from './ReportLog';

type IssueFilter = 'all' | IssueType;
type ReviewFilter = 'all' | ReportReview;

const reviewMeta: Record<ReportReview, { label: string; color: string }> = {
  pending: { label: 'To review', color: 'var(--status-low)' },
  confirmed: { label: 'Accepted', color: 'var(--status-restored)' },
  false_report: { label: 'False report', color: 'var(--ink-faint)' },
};

const PAGE = 30;

export function OperatorReports() {
  const toast = useToast();
  const { rows, setReview } = useReportLog();
  const { allowed } = useOperations();
  const canTriage = allowed('triage_reports');

  const [query, setQuery] = useState('');
  const [issue, setIssue] = useState<IssueFilter>('all');
  const [review, setReviewFilter] = useState<ReviewFilter>('all');
  const [areaId, setAreaId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (issue === 'all' || r.issue === issue) &&
        (review === 'all' || r.review === review) &&
        (!areaId || r.areaId === areaId) &&
        (!q || [r.id, r.reporter, r.place, areaById[r.areaId]?.name, r.note].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [rows, query, issue, review, areaId]);

  const counts = useMemo(
    () => ({
      pending: rows.filter((r) => r.review === 'pending').length,
      confirmed: rows.filter((r) => r.review === 'confirmed').length,
      false_report: rows.filter((r) => r.review === 'false_report').length,
    }),
    [rows],
  );

  const shown = filtered.slice(0, limit);
  const open = rows.find((r) => r.id === openId) ?? null;
  const allShownSelected = shown.length > 0 && shown.every((r) => selected.has(r.id));

  const apply = (ids: string[], value: ReportReview) => {
    setReview(ids, value);
    setSelected(new Set());
    toast({
      title: value === 'false_report' ? `${ids.length} marked as false` : `${ids.length} accepted`,
      body: value === 'false_report' ? 'They no longer count toward the fault.' : 'Counted toward their fault.',
    });
  };

  const exportCsv = () => {
    const header = ['id', 'reporter', 'area', 'place', 'issue', 'incident_status', 'review', 'minutes_ago', 'voltage', 'lat', 'lng', 'note'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [header.join(','), ...filtered.map((r) => [r.id, r.reporter, areaById[r.areaId]?.name, r.place, r.issue, r.status, r.review, r.minutesAgo, r.voltage, r.lat.toFixed(5), r.lng.toFixed(5), r.note].map(esc).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'voltiq-reports.csv' });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Page>
      <PageHeader
        title="Reports"
        subtitle={`${rows.length} reports from residents · ${counts.pending} waiting for review`}
        actions={
          <Button variant="secondary" size="sm" onClick={exportCsv} leading={<DownloadIcon className="h-4 w-4" aria-hidden="true" />}>
            Export CSV
          </Button>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search reports</span>
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, place, ID or note"
              className="h-11 w-full rounded-full border border-line bg-surface pl-10 pr-4 font-body text-sm text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none"
            />
          </label>
          <select
            aria-label="Area"
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
            className="h-11 rounded-full border border-line bg-surface px-4 font-body text-sm text-ink focus:border-ink focus:outline-none"
          >
            <option value="">All areas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterPill label="All" active={review === 'all'} onClick={() => setReviewFilter('all')} />
          <FilterPill label="To review" count={counts.pending} active={review === 'pending'} onClick={() => setReviewFilter('pending')} />
          <FilterPill label="Accepted" count={counts.confirmed} active={review === 'confirmed'} onClick={() => setReviewFilter('confirmed')} />
          <FilterPill label="False" count={counts.false_report} active={review === 'false_report'} onClick={() => setReviewFilter('false_report')} />
          <span className="basis-full sm:mx-1 sm:basis-auto sm:self-stretch sm:border-l sm:border-line" aria-hidden="true" />
          <FilterPill label="Any issue" active={issue === 'all'} onClick={() => setIssue('all')} />
          <FilterPill label="No light" active={issue === 'no_power'} onClick={() => setIssue('no_power')} />
          <FilterPill label="Low voltage" active={issue === 'low_voltage'} onClick={() => setIssue('low_voltage')} />
          <FilterPill label="Unstable" active={issue === 'fluctuating'} onClick={() => setIssue('fluctuating')} />
        </div>
      </div>

      <AnimatePresence>
        {selected.size > 0 && canTriage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg bg-ink p-2 pl-4 text-canvas shadow-float"
          >
            <span className="flex-1 font-body text-sm font-medium">{selected.size} selected</span>
            <button type="button" onClick={() => apply([...selected], 'confirmed')} className="h-9 rounded-full bg-canvas px-4 font-body text-sm font-medium text-ink">
              Accept
            </button>
            <button type="button" onClick={() => apply([...selected], 'false_report')} className="h-9 rounded-full border border-ink-faint px-4 font-body text-sm font-medium">
              Mark false
            </button>
            <button type="button" aria-label="Clear selection" onClick={() => setSelected(new Set())} className="flex h-9 w-9 items-center justify-center rounded-full hover:opacity-70">
              <XIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="overflow-hidden rounded-lg bg-surface shadow-card">
        {/* Phones: one card per report */}
        <ul className="divide-y divide-line md:hidden">
          {shown.map((r) => (
            <li key={r.id} className="flex items-start gap-3 p-4">
              {canTriage && (
                <input
                  type="checkbox"
                  aria-label={`Select ${r.id}`}
                  checked={selected.has(r.id)}
                  onChange={() =>
                    setSelected((s) => {
                      const next = new Set(s);
                      if (next.has(r.id)) next.delete(r.id);
                      else next.add(r.id);
                      return next;
                    })
                  }
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--ink)]"
                />
              )}
              <button type="button" onClick={() => setOpenId(r.id)} className="min-w-0 flex-1 text-left">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-body text-sm font-semibold text-ink">{r.reporter}</p>
                  <span className="shrink-0 font-body text-xs text-ink-faint">{formatAgo(r.minutesAgo)}</span>
                </div>
                <p className="truncate font-body text-xs text-ink-muted">
                  {areaById[r.areaId]?.name} · {r.place}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <IssueBadge issue={r.issue} className="h-6" />
                  <StatusBadge status={r.status} className="h-6" />
                  <ReviewTag review={r.review} />
                </div>
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="px-4 py-12 text-center font-body text-sm text-ink-muted">No reports match these filters.</li>}
        </ul>

        <div className="hidden md:block">
          <table className="w-full font-body text-sm">
            <thead className="border-b border-line">
              <tr className="text-left text-xs text-ink-faint">
                <th className="w-10 py-3 pl-4">
                  {canTriage && (
                    <input
                      type="checkbox"
                      aria-label="Select all shown"
                      checked={allShownSelected}
                      onChange={() => setSelected(allShownSelected ? new Set() : new Set(shown.map((r) => r.id)))}
                      className="h-4 w-4 accent-[var(--ink)]"
                    />
                  )}
                </th>
                <th className="px-2 py-3 font-medium">Report</th>
                <th className="px-2 py-3 font-medium">Where</th>
                <th className="px-2 py-3 font-medium">Issue</th>
                <th className="px-2 py-3 font-medium">Fault status</th>
                <th className="px-2 py-3 font-medium">Review</th>
                <th className="py-3 pl-2 pr-4 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setOpenId(r.id)}
                  className={cn('cursor-pointer transition-colors hover:bg-canvas', openId === r.id && 'bg-canvas')}
                >
                  <td className="py-2.5 pl-4" onClick={(e) => e.stopPropagation()}>
                    {canTriage && (
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.id}`}
                        checked={selected.has(r.id)}
                        onChange={() =>
                          setSelected((s) => {
                            const next = new Set(s);
                            if (next.has(r.id)) next.delete(r.id);
                            else next.add(r.id);
                            return next;
                          })
                        }
                        className="h-4 w-4 accent-[var(--ink)]"
                      />
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    <p className="font-semibold text-ink">{r.reporter}</p>
                    <p className="text-xs tabular-nums text-ink-faint">{r.id}</p>
                  </td>
                  <td className="max-w-[220px] px-2 py-2.5">
                    <p className="truncate text-ink">{areaById[r.areaId]?.name}</p>
                    <p className="truncate text-xs text-ink-faint">{r.place}</p>
                  </td>
                  <td className="px-2 py-2.5">
                    <IssueBadge issue={r.issue} className="h-6" />
                  </td>
                  <td className="px-2 py-2.5">
                    <StatusBadge status={r.status} className="h-6" />
                  </td>
                  <td className="px-2 py-2.5">
                    <ReviewTag review={r.review} />
                  </td>
                  <td className="whitespace-nowrap py-2.5 pl-2 pr-4 text-right text-xs text-ink-muted">{formatAgo(r.minutesAgo)}</td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-ink-muted">
                    No reports match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > limit && (
          <div className="border-t border-line p-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
              Show more · {filtered.length - limit} left
            </Button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {open && <ReportDrawer report={open} canTriage={canTriage} onClose={() => setOpenId(null)} onReview={(v) => apply([open.id], v)} />}
      </AnimatePresence>
    </Page>
  );
}

function ReviewTag({ review }: { review: ReportReview }) {
  const meta = reviewMeta[review];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function ReportDrawer({
  report: r,
  canTriage,
  onClose,
  onReview,
}: {
  report: ReportRow;
  canTriage: boolean;
  onClose: () => void;
  onReview: (v: ReportReview) => void;
}) {
  const where = describeLocation(r);
  return (
    <>
      <motion.div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgb(17 17 19 / 0.3)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.aside
        role="dialog"
        aria-label={`Report ${r.id}`}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-surface shadow-float"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="font-display text-lg font-bold text-ink">{r.reporter}</p>
            <p className="font-body text-xs tabular-nums text-ink-faint">
              {r.id} · {formatAgo(r.minutesAgo)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-sunken">
            <XIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="flex flex-wrap gap-1.5">
            <IssueBadge issue={r.issue} />
            <StatusBadge status={r.status} />
          </div>
          {r.note && <p className="rounded-md bg-canvas p-3 font-body text-sm italic text-ink">“{r.note}”</p>}
          <dl className="grid grid-cols-2 gap-4 font-body text-sm">
            <div className="col-span-2">
              <dt className="flex items-center gap-1.5 text-xs text-ink-faint">
                <MapPinIcon className="h-3.5 w-3.5" aria-hidden="true" /> Location
              </dt>
              <dd className="mt-0.5 text-ink">{where.summary}</dd>
              <dd className="text-xs tabular-nums text-ink-faint">
                {where.plusCode} · {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Merged into</dt>
              <dd className="mt-0.5 text-ink">{r.place}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-ink-faint">
                <GaugeIcon className="h-3.5 w-3.5" aria-hidden="true" /> Voltage
              </dt>
              <dd className="mt-0.5 tabular-nums text-ink">{r.voltage ? `${r.voltage} V` : 'Not given'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Phone</dt>
              <dd className="mt-0.5 tabular-nums text-ink">{r.phone}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Review</dt>
              <dd className="mt-1">
                <ReviewTag review={r.review} />
              </dd>
            </div>
          </dl>
        </div>
        <div className="space-y-2 border-t border-line p-5">
          {canTriage && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => onReview('false_report')} disabled={r.review === 'false_report'}>
                Mark false
              </Button>
              <Button onClick={() => onReview('confirmed')} disabled={r.review === 'confirmed'} leading={<CheckIcon className="h-4 w-4" aria-hidden="true" />}>
                Accept
              </Button>
            </div>
          )}
          <ButtonLink href={`/operator/map?focus=${r.incidentId}`} variant="ghost" full>
            Open fault on map
          </ButtonLink>
        </div>
      </motion.aside>
    </>
  );
}
