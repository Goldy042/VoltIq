'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';
import { ArrowRightIcon, ChevronDownIcon, ZapIcon } from 'lucide-react';
import { AnimatedCount } from '@/components/ui/AnimatedCount';
import { cn } from '@/components/ui/cn';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { incidents, type Area } from '@/data/nsukka';
import { AreaSearch } from './AreaSearch';
import { steps } from './steps';

const NightMap = dynamic(() => import('./NightMap').then((m) => m.NightMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#0b0b0d]" />,
});

const ease = [0.23, 1, 0.32, 1] as const;

/** Accent per chapter: the colour of what's happening on the map. */
const accent: Record<string, string> = {
  tonight: '#ffd479',
  dark: '#ff5c5f',
  reports: '#ff5c5f',
  low: '#ff9a3d',
  crew: '#7095ff',
  restored: '#3ccf8a',
  forecast: '#a08bff',
};

const liveReports = incidents.filter((i) => i.status !== 'restored').reduce((s, i) => s + i.reports, 0);

interface StoryProps {
  /** Fires when the reader scrolls past the night (nav switches to light). */
  onDaylight: (day: boolean) => void;
}

export function Story({ onDaylight }: StoryProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [step, setStep] = useState(0);
  const [reportCount, setReportCount] = useState(0);
  const [focus, setFocus] = useState<{ lng: number; lat: number; name: string } | null>(null);
  const compact = useMediaQuery('(max-width: 1023px)');
  const reducedMotion = Boolean(useReducedMotion());

  // Whichever step crosses the middle of the screen drives the map.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setStep(Number((e.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    stepRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Neighbours' reports tick in one by one.
  useEffect(() => {
    if (step < 3) return setReportCount(0);
    if (step > 3 || reducedMotion) return setReportCount(47);
    let n = 0;
    setReportCount(0);
    const timer = window.setInterval(() => {
      n += 1;
      setReportCount(n);
      if (n >= 47) window.clearInterval(timer);
    }, 55);
    return () => window.clearInterval(timer);
  }, [step, reducedMotion]);

  // Night fades to day as the story ends.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] });
  const dawn = useTransform(scrollYProgress, [0.9, 1], [0, 1]);
  useMotionValueEvent(scrollYProgress, 'change', (v) => onDaylight(v > 0.97));

  const scene = steps[step];
  const chapters = steps.slice(1, -1);

  return (
    <section ref={sectionRef} aria-label="One night in Nsukka" className="relative bg-[#0b0b0d] text-white">
      {/* ---- Fixed stage: the map and its overlays ---- */}
      <div className="sticky top-0 h-dvh w-full overflow-hidden">
        <NightMap step={step} reportCount={reportCount} focus={focus} compact={compact} reducedMotion={reducedMotion} />

        {/* Clock */}
        <div className="pointer-events-none absolute left-5 top-[calc(env(safe-area-inset-top)+76px)] lg:left-auto lg:right-10 lg:top-28 lg:text-right">
          <AnimatePresence mode="wait">
            {step > 0 && step < steps.length - 1 && (
              <motion.div
                key={scene.clock}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease }}
              >
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-white/50">Nsukka</p>
                <p className="font-display text-2xl font-bold tabular-nums tracking-tight lg:text-4xl">{scene.clock}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live report counter */}
        <AnimatePresence>
          {(step === 3 || step === 4 || step === 5) && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease }}
              className="pointer-events-none absolute right-5 top-[calc(env(safe-area-inset-top)+76px)] flex items-center gap-2 rounded-full bg-[#ff4d50] py-2 pl-3 pr-4 font-body text-sm font-semibold lg:left-1/2 lg:right-auto lg:top-8 lg:-translate-x-1/2"
            >
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="animate-pulse-ring absolute inset-0 rounded-full bg-white" />
                <span className="relative h-2 w-2 rounded-full bg-white" />
              </span>
              <AnimatedCount value={reportCount} /> reports
            </motion.div>
          )}
        </AnimatePresence>

        {/* Forecast push notification */}
        <AnimatePresence>
          {step === 7 && (
            <motion.div
              initial={{ opacity: 0, y: -40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.6 }}
              className="pointer-events-none absolute inset-x-4 top-[calc(env(safe-area-inset-top)+132px)] mx-auto max-w-sm rounded-[22px] bg-[#f3f3f0] p-3.5 text-[#111113] lg:inset-x-auto lg:right-10 lg:top-52 lg:w-[360px]"
              role="img"
              aria-label="Example phone notification: possible outage tonight in Odim Gate"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#111113]">
                  <ZapIcon className="h-3.5 w-3.5 fill-volt text-volt" aria-hidden="true" />
                </span>
                <span className="font-body text-xs font-semibold uppercase tracking-wide text-[#55575d]">VoltIq</span>
                <span className="ml-auto font-body text-xs text-[#73757c]">now</span>
              </div>
              <p className="mt-2 font-body text-[15px] font-semibold">Possible outage tonight, 7–10 PM</p>
              <p className="mt-0.5 font-body text-sm leading-snug text-[#55575d]">
                Odim Gate · 78% likely. Charge your phones and pump water before 7.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chapter rail */}
        <nav aria-label="Story chapters" className="absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
          {chapters.map((c, i) => {
            const index = i + 1;
            const active = step === index;
            return (
              <button
                key={c.id}
                type="button"
                aria-label={`Go to: ${c.title}`}
                aria-current={active || undefined}
                onClick={() => stepRefs.current[index]?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })}
                className="group flex h-4 items-center justify-end"
              >
                <motion.span
                  className="block h-1.5 rounded-full"
                  animate={{ width: active ? 28 : 6, backgroundColor: active ? accent[c.id] : 'rgba(255,255,255,0.35)' }}
                  transition={{ duration: 0.3, ease }}
                />
              </button>
            );
          })}
        </nav>

        {/* Dawn: the night hands over to the light page below */}
        <motion.div className="pointer-events-none absolute inset-0 bg-canvas" style={{ opacity: dawn }} aria-hidden="true" />
      </div>

      {/* ---- Scrolling text over the stage ---- */}
      <div className="relative z-10 -mt-[100dvh]">
        {/* Hero */}
        <div
          ref={(el) => {
            stepRefs.current[0] = el;
          }}
          data-step={0}
          className="flex min-h-dvh flex-col px-5 pb-10 pt-[calc(env(safe-area-inset-top)+92px)] lg:justify-center lg:px-10 lg:pb-24 lg:pt-24"
        >
          <div className="mx-auto w-full max-w-6xl">
            <div className="max-w-xl">
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease }}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#17181b] px-3 py-1.5 font-body text-xs font-medium text-white/80"
              >
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="animate-pulse-ring absolute inset-0 rounded-full bg-[#ff4d50]" />
                  <span className="relative h-2 w-2 rounded-full bg-[#ff4d50]" />
                </span>
                Live in Nsukka · {liveReports} reports right now
              </motion.p>

              <h1 className="mt-6 font-display text-5xl font-bold leading-tight tracking-tight">
                {['Know', 'before', 'the', 'light', 'goes.'].map((w, i) => (
                  <motion.span
                    key={w}
                    className={cn('mr-[0.22em] inline-block', w === 'light' && 'text-volt')}
                    initial={{ opacity: 0, y: '0.45em', filter: 'blur(6px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{ delay: 0.15 + i * 0.07, duration: 0.6, ease }}
                  >
                    {w}
                  </motion.span>
                ))}
              </h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5, ease }}
                className="mt-5 max-w-[42ch] font-body text-lg leading-body text-white/70"
              >
                Report no light or low voltage in one tap. See your neighbours on one live map of Nsukka. Get warned before the
                next outage.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, duration: 0.5, ease }}
                className="mt-8"
              >
                <AreaSearch
                  onPick={(a: Area | null) => setFocus(a ? { lng: a.lng, lat: a.lat, name: a.name } : null)}
                />
                <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <Link
                    href="/report"
                    className="group inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 font-body text-sm font-semibold text-[#111113] transition-transform active:scale-95"
                  >
                    Report a problem
                    <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                  <Link href="/map" className="font-body text-sm font-semibold text-white/80 underline decoration-white/30 underline-offset-4 hover:text-white hover:decoration-white">
                    Open the live map
                  </Link>
                </div>
              </motion.div>
            </div>
          </div>

          <motion.button
            type="button"
            onClick={() => stepRefs.current[1]?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mx-auto mt-auto flex flex-col items-center gap-1 pt-10 font-body text-sm text-white/60 hover:text-white lg:absolute lg:bottom-8 lg:left-1/2 lg:-translate-x-1/2"
          >
            Watch one night in Nsukka
            <motion.span animate={reducedMotion ? undefined : { y: [0, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
              <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
            </motion.span>
          </motion.button>
        </div>

        {/* Chapters */}
        {chapters.map((c, i) => {
          const index = i + 1;
          return (
            <div
              key={c.id}
              id={c.id}
              ref={(el) => {
                stepRefs.current[index] = el;
              }}
              data-step={index}
              className="pointer-events-none flex h-[115dvh] items-end px-4 pb-[max(env(safe-area-inset-bottom),20px)] lg:items-center lg:px-10 lg:pb-0"
            >
              <div className="mx-auto w-full max-w-6xl">
                <motion.article
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ amount: 0.6 }}
                  transition={{ duration: 0.55, ease }}
                  className="pointer-events-auto w-full max-w-[420px] rounded-xl border border-white/10 bg-[#111214] p-6 lg:p-7"
                >
                  {c.eyebrow && (
                    <p className="flex items-center gap-2 font-body text-sm font-semibold" style={{ color: accent[c.id] }}>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent[c.id] }} aria-hidden="true" />
                      {c.eyebrow}
                    </p>
                  )}
                  <h2 className="mt-3 font-display text-3xl font-bold leading-snug tracking-tight">{c.title}</h2>
                  {c.body && <p className="mt-3 font-body text-base leading-body text-white/70">{c.body}</p>}
                  <p className="mt-5 font-body text-xs font-semibold tabular-nums text-white/35">
                    {String(index).padStart(2, '0')} / {String(chapters.length).padStart(2, '0')}
                  </p>
                </motion.article>
              </div>
            </div>
          );
        })}

        {/* Outro beat: zoom out while night turns to day */}
        <div
          ref={(el) => {
            stepRefs.current[steps.length - 1] = el;
          }}
          data-step={steps.length - 1}
          className="h-[90dvh]"
          aria-hidden="true"
        />
      </div>
    </section>
  );
}
