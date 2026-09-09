import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRightIcon } from 'lucide-react';
import { OutageMap } from './OutageMap';
import { Reveal } from './Reveal';
import { weekStats } from '../data/mapData';

export function LiveMapPreview() {
  return (
    <section id="live-map" className="w-full border-b border-line bg-canvas">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-24 md:px-10 md:py-32">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-body text-2xs uppercase tracking-wide text-ink-faint">
              Live map
            </p>
            <h2 className="mt-6 max-w-[18ch] font-display text-3xl font-semibold leading-snug tracking-tight text-ink">
              The county, as the grid sees it right now.
            </h2>
          </div>
          <Link
            to="/map"
            className="group inline-flex items-center gap-2 border-b border-ink pb-1 font-body text-sm text-ink transition-colors duration-150 ease-out hover:border-accent hover:text-accent">
            
            Open the full map
            <ArrowUpRightIcon
              className="h-4 w-4 transition-transform duration-150 ease-out group-hover:-translate-y-0.5"
              aria-hidden="true" />
            
          </Link>
        </Reveal>

        <Reveal stagger className="mt-16 grid grid-cols-1 border-y border-line sm:grid-cols-3">
          {weekStats.map((stat, i) =>
          <div
            key={stat.label}
            className={`px-0 py-6 sm:px-8 ${
            i > 0 ? 'border-t border-line sm:border-l sm:border-t-0' : 'sm:pl-0'}`
            }>
            
              <p className="font-display text-4xl font-medium tabular-nums leading-tight tracking-tight text-ink">
                {stat.value}
              </p>
              <p className="mt-3 font-body text-sm text-ink-muted">{stat.label}</p>
              <p className="mt-1 font-body text-2xs uppercase tracking-wide text-ink-faint">
                {stat.context}
              </p>
            </div>
          )}
        </Reveal>

        <Reveal delay={0.05} className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-9">
            <OutageMap className="h-[340px] md:h-[480px]" />
          </div>
          <div className="lg:col-span-3 lg:pt-16">
            <p className="font-body text-base leading-body text-ink-muted">
              Every pin is a confirmed fault, a cluster of citizen reports, or a
              prediction the model has not yet been proven wrong about.
            </p>
            <p className="mt-6 font-body text-xs leading-body text-ink-faint">
              Data shown is a demonstration snapshot from the Bellhaven pilot
              network.
            </p>
          </div>
        </Reveal>
      </div>
    </section>);

}