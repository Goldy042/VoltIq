import React from 'react';
import type { CitizenReport } from '../../data/citizen';
import { reportStatusColor, reportStatusLabels } from '../../data/citizen';

interface ReportListProps {
  reports: CitizenReport[];
}

export function ReportList({ reports }: ReportListProps) {
  return (
    <section aria-labelledby="past-reports-heading">
      <div className="flex items-baseline justify-between border-b border-line pb-3">
        <h2
          id="past-reports-heading"
          className="font-body text-2xs uppercase tracking-wide text-ink-faint">
          
          Your reports
        </h2>
        <span className="font-body text-2xs tabular-nums text-ink-faint">
          {reports.length} total
        </span>
      </div>

      {reports.length === 0 ?
      <p className="py-10 font-body text-sm text-ink-muted">
          You haven't reported an outage yet. When you do, it will show here with
          its status as crews work through it.
        </p> :

      <ul className="divide-y divide-line">
          {reports.map((report) =>
        <li key={report.id} className="py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-display text-base font-medium text-ink">
                  {report.location}
                </p>
                <span className="flex items-center gap-2">
                  <span
                className="h-[6px] w-[6px] rounded-full"
                style={{ backgroundColor: reportStatusColor[report.status] }}
                aria-hidden="true" />
              
                  <span
                className="font-body text-2xs uppercase tracking-wide"
                style={{ color: reportStatusColor[report.status] }}>
                
                    {reportStatusLabels[report.status]}
                  </span>
                </span>
              </div>

              <p className="mt-2 font-body text-xs tabular-nums text-ink-faint">
                Started {report.startedAt} · reported {report.submittedAt} · ref{' '}
                {report.id}
              </p>

              {report.note &&
          <p className="mt-2 max-w-[62ch] font-body text-sm leading-body text-ink-muted">
                  {report.note}
                </p>
          }
            </li>
        )}
        </ul>
      }
    </section>);

}