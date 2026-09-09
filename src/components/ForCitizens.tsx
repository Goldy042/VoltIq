import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { Reveal } from './Reveal';

export function ForCitizens() {
  return (
    <section id="citizens" className="w-full border-b border-line bg-canvas">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-24 md:px-10 md:py-32">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-4 lg:col-start-2">
            <div
              className="border border-line bg-surface p-6"
              style={{ borderRadius: 'var(--radius-sm)' }}>
              
              <div className="flex items-center justify-between">
                <span className="font-body text-2xs uppercase tracking-wide text-ink-faint">
                  Gridpulse alert
                </span>
                <span className="font-body text-2xs tabular-nums text-ink-faint">
                  14:52
                </span>
              </div>
              <p className="mt-6 font-display text-xl font-medium leading-snug tracking-tight text-ink">
                Power on Alder Street is likely to go out around 21:00 tonight.
              </p>
              <p className="mt-4 font-body text-sm leading-body text-ink-muted">
                Northfield feeder 303 is showing the same pattern it did before
                the March fault. Charge what you need before nine.
              </p>
              <div className="mt-6 flex items-center gap-3 border-t border-line pt-4">
                <span
                  className="h-[6px] w-[6px] rounded-full"
                  style={{ backgroundColor: 'var(--status-predicted)' }}
                  aria-hidden="true" />
                
                <span className="font-body text-2xs uppercase tracking-wide text-ink-faint">
                  Predicted · 78% confidence
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.08} className="lg:col-span-5 lg:col-start-7 lg:pt-12">
            <p className="font-body text-2xs uppercase tracking-wide text-ink-faint">
              For citizens
            </p>
            <h2 className="mt-6 max-w-[16ch] font-display text-4xl font-semibold leading-tight tracking-tight text-ink">
              Report it once. Hear about the next one first.
            </h2>
            <p className="mt-8 max-w-[48ch] font-body text-lg leading-body text-ink-muted">
              Reporting takes a tap and works without an account. Create one and
              your street is watched for you — you get told before the lights go,
              not after, and you can see exactly when a crew was dispatched.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                to="/signup"
                className="group inline-flex items-center gap-2 border border-ink bg-ink px-6 py-3 font-body text-sm font-medium text-canvas transition-colors duration-150 ease-out hover:border-accent hover:bg-accent hover:text-accent-on"
                style={{ borderRadius: 'var(--radius-sm)' }}>
                
                Create an account
                <ArrowRightIcon
                  className="h-4 w-4 transition-transform duration-150 ease-out group-hover:translate-x-1"
                  aria-hidden="true" />
                
              </Link>
              <Link
                to="/report"
                className="inline-flex items-center border border-line-strong px-6 py-3 font-body text-sm text-ink transition-colors duration-150 ease-out hover:border-ink"
                style={{ borderRadius: 'var(--radius-sm)' }}>
                
                Report without an account
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>);

}