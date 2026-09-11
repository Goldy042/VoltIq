import React from 'react';
import Link from 'next/link';
import { ArrowRightIcon } from 'lucide-react';
import { GridSignal } from './GridSignal';

interface HeroProps {
  /** Swap the eyebrow line between the citizen and utility framing. */
  audience?: 'citizens' | 'utilities';
}

const eyebrow = {
  citizens: 'Community outage intelligence · Bellhaven County',
  utilities: 'Distribution intelligence · 41 feeders monitored'
};

export function Hero({ audience = 'citizens' }: HeroProps) {
  return (
    <section id="top" className="w-full border-b border-line bg-canvas">
      <div className="mx-auto w-full max-w-[1440px] px-6 md:px-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Headline column — offset from the left edge, never centered */}
          <div className="pt-16 lg:col-span-7 lg:col-start-1 lg:pb-32 lg:pt-32">
            <p className="font-body text-2xs uppercase tracking-wide text-ink-faint">
              {eyebrow[audience]}
            </p>

            <h1 className="mt-8 max-w-[15ch] font-display text-5xl font-semibold leading-tight tracking-tight text-ink">
              Know the outage
              <br />
              before the
              <span className="text-accent"> lights go</span>.
            </h1>

            <p className="mt-8 max-w-[46ch] font-body text-lg leading-body text-ink-muted">
              Neighbours report what they see. Our models read the grid's own
              signals. Together they tell you which streets go dark next — hours
              before a single bulb flickers.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="/report"
                className="group inline-flex items-center gap-2 border border-ink bg-ink px-6 py-3 font-body text-sm font-medium text-canvas transition-colors duration-150 ease-out hover:border-accent hover:bg-accent hover:text-accent-on"
                style={{ borderRadius: 'var(--radius-sm)' }}>
                
                Report an outage
                <ArrowRightIcon
                  className="h-4 w-4 transition-transform duration-150 ease-out group-hover:translate-x-1"
                  aria-hidden="true" />
                
              </Link>
              <a
                href="#live-map"
                className="inline-flex items-center border border-line-strong px-6 py-3 font-body text-sm text-ink transition-colors duration-150 ease-out hover:border-ink"
                style={{ borderRadius: 'var(--radius-sm)' }}>
                
                See the live map
              </a>
            </div>

            <dl className="mt-16 grid max-w-xl grid-cols-3 gap-8 border-t border-line pt-6">
              {[
              { value: '6.4 hrs', label: 'Median warning lead time' },
              { value: '12,430', label: 'Households covered' },
              { value: '78%', label: 'Predicted faults confirmed' }].
              map((stat) =>
              <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="block font-display text-xl font-medium tabular-nums text-ink">
                      {stat.value}
                    </span>
                    <span className="mt-1 block font-body text-xs leading-snug text-ink-faint">
                      {stat.label}
                    </span>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Data column — starts lower than the headline, deliberately unbalanced */}
          <div className="pb-16 lg:col-span-4 lg:col-start-9 lg:pb-32 lg:pt-48">
            <GridSignal />
            <p className="mt-4 max-w-[38ch] font-body text-xs leading-body text-ink-faint">
              Four of forty-one feeders shown. Predictions refresh every ninety
              seconds from weather, load and fault history.
            </p>
          </div>
        </div>
      </div>
    </section>);

}