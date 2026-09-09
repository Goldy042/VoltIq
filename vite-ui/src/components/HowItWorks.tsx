import React from 'react';
import { MegaphoneIcon, CrosshairIcon, BellRingIcon } from 'lucide-react';
import { Reveal } from './Reveal';

const steps = [
{
  n: '01',
  title: 'A neighbour reports',
  icon: MegaphoneIcon,
  body: 'One tap, no account needed. Address, time, and what they saw — a flicker, a bang, a dark street.',
  meta: 'Median report time: 18 seconds'
},
{
  n: '02',
  title: 'The model finds the fault',
  icon: CrosshairIcon,
  body: 'Live reports are cross-read against feeder load, weather and fault history until the affected span narrows to a block.',
  meta: 'Fault area resolved to ~120 m'
},
{
  n: '03',
  title: 'Crews move, streets are warned',
  icon: BellRingIcon,
  body: 'The distribution company dispatches to the confirmed span. Where a failure is only predicted, the affected households are told first.',
  meta: '6.4 hrs median warning'
}];


export function HowItWorks() {
  return (
    <section id="how-it-works" className="w-full border-b border-line bg-canvas">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-24 md:px-10 md:py-32">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-3">
            <p className="font-body text-2xs uppercase tracking-wide text-ink-faint">
              How it works
            </p>
            <h2 className="mt-6 max-w-[12ch] font-display text-3xl font-semibold leading-snug tracking-tight text-ink">
              Three moves between a dark street and a crew.
            </h2>
          </Reveal>

          <div className="lg:col-span-8 lg:col-start-5">
            <ol className="grid grid-cols-1 border-t border-line md:grid-cols-3">
              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <Reveal
                    as="li"
                    key={step.n}
                    delay={i * 0.08}
                    className={`flex flex-col border-line pt-6 md:pr-8 ${
                    i > 0 ? 'border-t md:border-l md:border-t-0 md:pl-8' : ''} ${
                    i > 0 ? 'mt-8 md:mt-0' : ''}`}>
                    
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm font-medium tabular-nums text-accent">
                        {step.n}
                      </span>
                      <Icon
                        className="h-4 w-4 text-ink-faint"
                        strokeWidth={1.5}
                        aria-hidden="true" />
                      
                    </div>

                    <h3 className="mt-8 font-display text-xl font-medium leading-snug tracking-tight text-ink">
                      {step.title}
                    </h3>
                    <p className="mt-3 font-body text-sm leading-body text-ink-muted">
                      {step.body}
                    </p>
                    <p className="mt-auto pt-8 font-body text-2xs uppercase tracking-wide text-ink-faint">
                      {step.meta}
                    </p>
                  </Reveal>);

              })}
            </ol>
          </div>
        </div>
      </div>
    </section>);

}