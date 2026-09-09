import React from 'react';
import { ArrowRightIcon } from 'lucide-react';
import { Reveal } from './Reveal';

const dispatchRows = [
{ span: 'Old Mill · span 114-C', crew: 'Crew 4', eta: 'On site', status: 'critical' },
{ span: 'Rivergate · span 207-A', crew: 'Crew 2', eta: '11 min', status: 'reported' },
{ span: 'Northfield · span 303-F', crew: 'Unassigned', eta: 'Pre-stage', status: 'predicted' }];


const statusColor: Record<string, string> = {
  critical: 'var(--status-critical)',
  reported: 'var(--status-reported)',
  predicted: 'var(--status-predicted)'
};

export function ForUtilities() {
  return (
    <section id="utilities" className="w-full border-b border-line bg-sunken">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-24 md:px-10 md:py-32">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-6">
            <p className="font-body text-2xs uppercase tracking-wide text-ink-faint">
              For distribution companies
            </p>
            <h2 className="mt-6 max-w-[16ch] font-display text-4xl font-semibold leading-tight tracking-tight text-ink">
              Stop learning about faults from the call centre.
            </h2>
            <p className="mt-8 max-w-[52ch] font-body text-lg leading-body text-ink-muted">
              GridPulse turns scattered citizen reports and feeder telemetry into
              a single ranked worklist: where the fault is, how many households
              it holds, and which crew is closest. Predicted failures arrive
              early enough to be scheduled rather than survived.
            </p>

            <ul className="mt-10 max-w-[52ch] divide-y divide-line border-y border-line font-body text-sm text-ink-muted">
              <li className="py-3">
                Fault areas narrowed to a span, not a postcode
              </li>
              <li className="py-3">
                Dispatch and crew status in the same view as the map
              </li>
              <li className="py-3">
                Pilot deployments run on existing SCADA exports — no new hardware
              </li>
            </ul>

            <a
              href="#partner"
              className="group mt-10 inline-flex items-center gap-2 border border-ink bg-ink px-6 py-3 font-body text-sm font-medium text-canvas transition-colors duration-150 ease-out hover:border-accent hover:bg-accent hover:text-accent-on"
              style={{ borderRadius: 'var(--radius-sm)' }}>
              
              Partner with us
              <ArrowRightIcon
                className="h-4 w-4 transition-transform duration-150 ease-out group-hover:translate-x-1"
                aria-hidden="true" />
              
            </a>
          </Reveal>

          <Reveal
            delay={0.08}
            className="lg:col-span-5 lg:col-start-8 lg:pt-24">
            
            <div
              className="border border-line bg-surface"
              style={{ borderRadius: 'var(--radius-sm)' }}>
              
              <div className="flex items-baseline justify-between border-b border-line px-6 py-3">
                <span className="font-body text-2xs uppercase tracking-wide text-ink-faint">
                  Dispatch queue
                </span>
                <span className="font-body text-2xs tabular-nums text-ink-faint">
                  Shift 2 · 14:20
                </span>
              </div>
              <table className="w-full">
                <caption className="sr-only">
                  Example dispatch queue with span, crew and estimated arrival
                </caption>
                <thead>
                  <tr className="border-b border-line text-left">
                    {['Span', 'Crew', 'ETA'].map((h) =>
                    <th
                      key={h}
                      scope="col"
                      className="px-6 py-2 font-body text-2xs uppercase tracking-wide text-ink-faint">
                      
                        {h}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {dispatchRows.map((row) =>
                  <tr key={row.span}>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-3">
                          <span
                          className="h-[6px] w-[6px] shrink-0 rounded-full"
                          style={{ backgroundColor: statusColor[row.status] }}
                          aria-hidden="true" />
                        
                          <span className="font-body text-sm text-ink">
                            {row.span}
                          </span>
                        </span>
                      </td>
                      <td className="px-6 py-4 font-body text-sm text-ink-muted">
                        {row.crew}
                      </td>
                      <td className="px-6 py-4 font-body text-sm tabular-nums text-ink-muted">
                        {row.eta}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </div>
    </section>);

}