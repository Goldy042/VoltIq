import React, { useState } from 'react';
import { ZapOffIcon } from 'lucide-react';
import { CitizenHeader } from '../components/citizen/CitizenHeader';
import { AreaStatusCard } from '../components/citizen/AreaStatusCard';
import { PredictedAlertCard } from '../components/citizen/PredictedAlertCard';
import { ReportList } from '../components/citizen/ReportList';
import { ReportOutageModal } from '../components/citizen/ReportOutageModal';
import { OutageMap } from '../components/OutageMap';
import { citizenProfile, pastReports } from '../data/citizen';
import type { CitizenReport } from '../data/citizen';

interface DashboardProps {
  /** Open the report sheet on arrival (used by the /report route). */
  reportOpen?: boolean;
}

export function Dashboard({ reportOpen = false }: DashboardProps) {
  const [open, setOpen] = useState(reportOpen);
  const [alertVisible, setAlertVisible] = useState(true);
  const [reports, setReports] = useState<CitizenReport[]>(pastReports);

  const addReport = (data: {location: string;startedAt: string;note?: string;}) => {
    setReports((prev) => [
    {
      id: `r-${Math.floor(2100 + Math.random() * 800)}`,
      location: data.location,
      startedAt: data.startedAt,
      submittedAt: new Date().toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }),
      status: 'submitted',
      note: data.note
    },
    ...prev]
    );
  };

  return (
    <div className="min-h-screen w-full bg-canvas">
      <CitizenHeader />

      <main className="mx-auto w-full max-w-[1120px] px-5 pb-28 pt-8 md:px-8 md:pb-20 md:pt-14">
        <p className="font-body text-2xs uppercase tracking-wide text-ink-faint">
          {citizenProfile.feeder}
        </p>
        <h1 className="mt-4 max-w-[16ch] font-display text-3xl font-semibold leading-tight tracking-tight text-ink md:text-4xl">
          Good evening, {citizenProfile.name.split(' ')[0]}.
        </h1>

        {alertVisible &&
        <div className="mt-8">
            <PredictedAlertCard onDismiss={() => setAlertVisible(false)} />
          </div>
        }

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <AreaStatusCard />

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-6 hidden w-full items-center justify-between border border-ink bg-ink px-6 py-5 text-left font-display text-xl font-medium tracking-tight text-canvas transition-colors duration-150 ease-out hover:border-accent hover:bg-accent hover:text-accent-on md:flex"
              style={{ borderRadius: 'var(--radius-sm)' }}>
              
              Report an outage
              <ZapOffIcon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
            </button>

            <div className="mt-12">
              <ReportList reports={reports} />
            </div>
          </div>

          <div className="lg:col-span-4 lg:col-start-9 lg:pt-4">
            <OutageMap className="h-56" showLegend={false} />
            <p className="mt-3 font-body text-xs leading-body text-ink-faint">
              Your block sits on feeder 303. Pins near you are what the
              distribution company is currently working.
            </p>
          </div>
        </div>
      </main>

      {/* Mobile: the primary action stays reachable at the thumb */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-canvas px-5 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between border border-ink bg-ink px-5 py-4 font-display text-lg font-medium tracking-tight text-canvas transition-colors duration-150 ease-out active:border-accent active:bg-accent active:text-accent-on"
          style={{ borderRadius: 'var(--radius-sm)' }}>
          
          Report an outage
          <ZapOffIcon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      <ReportOutageModal
        open={open}
        onClose={() => setOpen(false)}
        onSubmitted={addReport} />
      
    </div>);

}