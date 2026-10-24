'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CheckIcon, MapIcon, XIcon } from 'lucide-react';
import { MapCanvas } from '@/components/map';
import { IncidentInfoForm } from '@/components/map/IncidentInfo';
import { OperatorActions } from '@/components/map/IncidentDetail';
import { OutageTimeline, ReportsOverTime, dayTime, span } from '@/components/outage/OutageParts';
import { useToast } from '@/components/ui/Toast';
import { areaById, statusMeta, type IncidentStatus } from '@/data/nsukka';
import type { ReportReview } from '@/data/operations';
import { useSharedOutageFeed } from '@/hooks/useOutageFeed';
import { useOutageDetail } from '@/hooks/useOutageDetail';
import { api, ApiFailure } from '@/lib/api';
import type { OutageDetail } from '@/lib/incidents';
import { flagLabel } from '@/lib/reporting';
import { useOperations } from '@/lib/operations';
import { OutageReach } from '@/components/outage/OutageReach';
import { scopeMeta } from '@/lib/footprint';
import { AskNearbyButton } from './AskNearbyButton';
import { useReportLog } from './ReportLog';
import { Card, IssueTag, KpiStrip, Page, PageHeader, Tag } from './parts';

const reviewMeta: Record<ReportReview, { label: string; color: string }> = {
  pending: { label: 'To review', color: 'var(--status-low)' },
  confirmed: { label: 'Accepted', color: 'var(--status-restored)' },
  false_report: { label: 'False', color: 'var(--status-out)' },
};

/** Everything about one outage for EEDC staff, with every control in one place. */
export function OperatorOutage({ initial }: { initial: OutageDetail }) {
  const { detail, refresh } = useOutageDetail(initial, { staff: true });
  const { incident } = detail;
  const feed = useSharedOutageFeed();
  const { allowed } = useOperations();
  const { setReview } = useReportLog();
  const toast = useToast();
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const area = areaById[incident.areaId];
  const restored = incident.status === 'restored';
  const reports = detail.reports ?? [];
  const pending = reports.filter((r) => r.review === 'pending');
  const shown = showFlaggedOnly ? reports.filter((r) => r.flags?.length) : reports;
  const ref = `VQ-${incident.id.slice(0, 6).toUpperCase()}`;

  const after = async (work: Promise<unknown>, ok: string) => {
    try {
      await work;
      toast({ title: ok, body: incident.place });
    } catch (e) {
      toast({ title: 'Not saved', body: e instanceof ApiFailure ? e.message : 'Try again in a moment.', color: 'var(--status-out)' });
    } finally {
      void refresh();
      feed.refresh();
    }
  };

  const setStatus = (status: IncidentStatus) =>
    after(
      api(`/api/operator/incidents/${incident.id}/status`, { body: { status } }),
      status === 'restored' ? 'Marked as restored' : status === 'confirmed' ? 'Fault confirmed' : 'Status updated',
    );
  const dispatch = (teamId: string) => after(api(`/api/operator/incidents/${incident.id}/dispatch`, { body: { teamId } }), 'Team dispatched');
  const review = (ids: string[], r: ReportReview) => {
    setReview(ids, r);
    window.setTimeout(() => void refresh(), 800);
  };

  return (
    <Page wide>
      <PageHeader
        eyebrow={`Outage · ${ref}`}
        title={incident.place}
        subtitle={`${incident.area}${area ? ` · ${area.feeder} · Band ${area.band}` : ''} · started ${dayTime(detail.startedAt)}`}
        actions={
          <>
            <Tag color={restored ? 'var(--status-restored)' : statusMeta[incident.status].color}>{statusMeta[incident.status].label}</Tag>
            <IssueTag issue={incident.issue} />
            <Link
              href={`/operator/map?focus=${incident.id}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 font-body text-xs text-ink-muted ring-1 ring-line hover:text-ink"
            >
              <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
              On the map
            </Link>
          </>
        }
      />

      <KpiStrip
        wide={false}
        items={[
          { label: 'Residents reporting', value: incident.reports, tone: 'var(--status-out)', spark: detail.reportsOverTime.counts.length > 1 ? detail.reportsOverTime.counts : undefined },
          { label: 'Homes affected', value: `~${incident.households.toLocaleString()}`, hint: incident.scope ? `${scopeMeta[incident.scope].label} · ${incident.lightOn ?? 0} nearby have light` : `${incident.radius} m radius` },
          {
            label: restored ? 'Was off for' : 'Off for',
            value: span(detail.startedAt, detail.restoredAt),
            tone: restored ? 'var(--status-restored)' : 'var(--status-low)',
            hint: detail.confirmedAt ? `Confirmed after ${span(detail.startedAt, detail.confirmedAt)}` : 'Not confirmed yet',
          },
          { label: 'Say light is back', value: detail.lightBack, hint: pending.length ? `${pending.length} report${pending.length === 1 ? '' : 's'} to review` : 'No reports to review' },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="min-w-0 space-y-5">
          <Card title="Reports over time">
            <ReportsOverTime detail={detail} height={140} />
          </Card>

          <Card
            title={`Reports (${reports.length})`}
            action={
              <div className="flex items-center gap-2">
                {pending.length > 0 && allowed('triage_reports') && (
                  <button
                    type="button"
                    onClick={() => review(pending.map((r) => r.id), 'confirmed')}
                    className="h-8 rounded-sm px-2.5 font-body text-xs font-medium text-ink ring-1 ring-line hover:bg-raised"
                  >
                    Accept all {pending.length}
                  </button>
                )}
                <button
                  type="button"
                  aria-pressed={showFlaggedOnly}
                  onClick={() => setShowFlaggedOnly((v) => !v)}
                  className={`h-8 rounded-sm px-2.5 font-body text-xs font-medium ring-1 ${showFlaggedOnly ? 'bg-raised text-ink ring-accent' : 'text-ink-muted ring-line hover:text-ink'}`}
                >
                  Flagged only
                </button>
              </div>
            }
          >
            {shown.length === 0 ? (
              <p className="py-6 text-center font-body text-sm text-ink-muted">{showFlaggedOnly ? 'No flagged reports on this outage.' : 'No reports.'}</p>
            ) : (
              <div className="-mx-4 overflow-x-auto lg:-mx-5">
                <table className="w-full min-w-[640px] font-body text-sm">
                  <thead>
                    <tr className="border-b border-line text-left font-mono text-2xs uppercase tracking-wide text-ink-faint">
                      <th className="px-4 py-2 font-medium lg:px-5">Ref</th>
                      <th className="px-2 py-2 font-medium">Resident</th>
                      <th className="px-2 py-2 font-medium">When</th>
                      <th className="px-2 py-2 font-medium">Checks</th>
                      <th className="px-2 py-2 font-medium">Review</th>
                      <th className="px-4 py-2 lg:px-5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {shown.map((r) => (
                      <tr key={r.id} className="align-top">
                        <td className="px-4 py-2.5 font-mono text-xs text-ink-muted lg:px-5">{r.ref ?? r.id}</td>
                        <td className="px-2 py-2.5">
                          <p className="text-ink">{r.reporter}</p>
                          <p className="text-xs tabular-nums text-ink-faint">{r.phone}</p>
                          {r.note && <p className="mt-1 max-w-[32ch] text-xs text-ink-muted">“{r.note}”</p>}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-xs text-ink-muted">
                          {r.minutesAgo < 60 ? `${r.minutesAgo} min ago` : `${Math.floor(r.minutesAgo / 60)} hr ago`}
                          {r.voltage !== undefined && <span className="block text-status-low">{r.voltage} V</span>}
                        </td>
                        <td className="px-2 py-2.5 text-xs">
                          {r.flags?.length ? (
                            <ul className="space-y-0.5 text-status-low">
                              {r.flags.map((f) => (
                                <li key={f}>{flagLabel[f as keyof typeof flagLabel] ?? f}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-ink-faint">Passed</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5">
                          <Tag color={reviewMeta[r.review].color}>{reviewMeta[r.review].label}</Tag>
                        </td>
                        <td className="px-4 py-2.5 lg:px-5">
                          {allowed('triage_reports') && r.review === 'pending' && (
                            <span className="flex justify-end gap-1">
                              <button
                                type="button"
                                aria-label={`Accept ${r.ref ?? 'report'}`}
                                onClick={() => review([r.id], 'confirmed')}
                                className="flex h-8 w-8 items-center justify-center rounded-sm text-status-restored ring-1 ring-line hover:bg-raised"
                              >
                                <CheckIcon className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Mark ${r.ref ?? 'report'} false`}
                                onClick={() => review([r.id], 'false_report')}
                                className="flex h-8 w-8 items-center justify-center rounded-sm text-status-out ring-1 ring-line hover:bg-raised"
                              >
                                <XIcon className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6">
          {(allowed('dispatch_teams') || allowed('triage_reports')) && (
            <Card title={restored ? 'Closed' : 'Actions'}>
              <div className="space-y-3">
                <OperatorActions incident={incident} crews={detail.teams ?? []} onStatus={setStatus} onDispatch={dispatch} />
                {!restored && <IncidentInfoForm incident={incident} onSaved={() => void refresh()} />}
                {restored && (
                  <button
                    type="button"
                    onClick={() => setStatus('confirmed')}
                    className="h-9 w-full rounded-sm font-body text-sm text-ink-muted ring-1 ring-line hover:text-ink"
                  >
                    Reopen — light went off again
                  </button>
                )}
              </div>
            </Card>
          )}

          <Card title="How far it reaches" action={<AskNearbyButton incident={incident} onDone={() => void refresh()} />}>
            <OutageReach incident={incident} staff bare className="mb-4" />
            <div className="-mx-4 -mb-4 h-72 overflow-hidden lg:-mx-5 lg:-mb-5">
              <MapCanvas
                incidents={[incident]}
                dots={detail.dots}
                crews={detail.teams ?? []}
                showSubstations
                selectedId={incident.id}
                initialCenter={incident}
                initialZoom={15.4}
              />
            </div>
          </Card>

          <Card title="Timeline">
            <OutageTimeline detail={detail} />
          </Card>
        </aside>
      </div>
    </Page>
  );
}
