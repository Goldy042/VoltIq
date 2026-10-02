'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CameraIcon,
  CheckIcon,
  LocateFixedIcon,
  MapPinIcon,
  SearchIcon,
  SunIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import { LocationPicker } from '@/components/map';
import { Button, ButtonLink } from '@/components/ui/Button';
import { OptionCards } from '@/components/ui/OptionCards';
import { TextField } from '@/components/ui/TextField';
import { TextArea } from '@/components/ui/TextArea';
import { IssueIcon } from '@/components/ui/Badges';
import { cn } from '@/components/ui/cn';
import { issueMeta, statusMeta, type IssueType } from '@/data/nsukka';
import { searchPlaces } from '@/lib/address';
import { api, ApiFailure, waitText } from '@/lib/api';
import { distanceMeters, formatAgo } from '@/lib/geo';
import { locateBest, type Fix } from '@/lib/locate';
import { placeName, useProfile } from '@/lib/profile';
import type { ReportContext, ReportInput, SubmitResult } from '@/lib/reporting';

type Step = 0 | 1 | 2 | 3;

const stepTitles = ['What’s happening?', 'Where is it?', 'A few details'];

function nowLocalValue() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const minutesSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 60_000;

export function ReportScreen({ initialIssue }: { initialIssue?: IssueType }) {
  const [step, setStep] = useState<Step>(initialIssue ? 1 : 0);
  const [direction, setDirection] = useState(1);
  const [issue, setIssue] = useState<IssueType | null>(initialIssue ?? null);
  const [issueError, setIssueError] = useState<string>();
  const { primary, profile } = useProfile();
  const [pos, setPos] = useState({ lat: primary.lat, lng: primary.lng });
  const [recenter, setRecenter] = useState(0);
  const [locating, setLocating] = useState(false);
  // Where the phone is. Sent with the report even if the pin is moved (abuse checks).
  const [device, setDevice] = useState<Fix | null>(null);
  const [query, setQuery] = useState('');
  const [landmark, setLandmark] = useState('');
  // Set after mount: server and browser timezones differ, which would break hydration.
  const [startedAt, setStartedAt] = useState('');
  const [maxTime, setMaxTime] = useState<string>();
  const [voltage, setVoltage] = useState('');
  const [voltageError, setVoltageError] = useState<string>();
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | { outcome: 'light_back' | 'still_off'; area: string } | null>(null);

  // Server's view of this pin: area suggestions, outages nearby, your open report.
  const [ctx, setCtx] = useState<ReportContext | null>(null);
  const [chosenArea, setChosenArea] = useState<string | null>(null);

  useEffect(() => {
    const now = nowLocalValue();
    setStartedAt(now);
    setMaxTime(now);
  }, []);

  // If location is already allowed, quietly find the phone so the pin starts where you are.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || typeof navigator === 'undefined' || !navigator.permissions) return;
    asked.current = true;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((p) => p.state === 'granted' && findMe(true))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const acc = device && distanceMeters(device, pos) <= Math.max(device.accuracy, 30) ? device.accuracy : 0;
      api<ReportContext>(`/api/reports/context?lat=${pos.lat}&lng=${pos.lng}&accuracy=${Math.round(acc)}`)
        .then((c) => {
          setCtx(c);
          setChosenArea((a) => (a && c.areas.some((x) => x.slug === a) ? a : null));
        })
        .catch(() => setCtx(null));
    }, 350);
    return () => window.clearTimeout(t);
  }, [pos, device]);

  const results = useMemo(() => searchPlaces(query, 5), [query]);
  const area = ctx?.areas.find((a) => a.slug === chosenArea) ?? ctx?.areas[0] ?? null;
  const joining = ctx?.nearby.find((i) => i.issue === issue && i.areaSlug === area?.slug && (i.distanceM ?? 0) <= i.radiusM + 300);
  const mine = ctx?.myOpen ?? null;

  const go = (next: Step) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
    setSendError(null);
  };

  const moveTo = (p: { lat: number; lng: number }) => {
    setPos(p);
    setRecenter(Date.now());
  };

  function findMe(quiet = false) {
    if (!quiet) setLocating(true);
    locateBest({
      onFix: (fix) => {
        setDevice(fix);
        moveTo(fix);
      },
      onDone: (fix) => {
        setLocating(false);
        setDevice(fix);
        moveTo(fix);
      },
      onError: (err) => {
        setLocating(false);
        if (!quiet) setSendError(err === 'outside' ? 'You seem to be outside Nsukka. Move the pin to where the outage is.' : 'Couldn’t get your location. Drag the map or search a landmark.');
      },
    });
  }

  const answerMine = async (back: boolean) => {
    if (!mine) return;
    setSending(true);
    try {
      await api(`/api/reports/${mine.id}/light`, { body: { back } });
      setResult({ outcome: back ? 'light_back' : 'still_off', area: mine.areaName });
      setStep(3);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    if (!issue) return go(0);
    if (voltage && (Number(voltage) < 0 || Number(voltage) > 300)) {
      return setVoltageError('Enter a reading between 0 and 300 volts.');
    }
    setSending(true);
    setSendError(null);
    const body: ReportInput = {
      issue,
      lat: pos.lat,
      lng: pos.lng,
      device: device ? { lat: device.lat, lng: device.lng, accuracy: Math.round(device.accuracy) } : undefined,
      areaSlug: area?.slug,
      startedAt: startedAt ? new Date(startedAt).toISOString() : new Date().toISOString(),
      voltage: voltage ? Number(voltage) : undefined,
      note: note.trim() || undefined,
      landmark: landmark.trim() || undefined,
    };
    try {
      setResult(await api<SubmitResult>('/api/reports', { body }));
      setDirection(1);
      setStep(3);
    } catch (e) {
      if (e instanceof ApiFailure && e.code === 'rate_limited') {
        setSendError(`${e.message} You can send another in about ${waitText(e.retryAfterSec ?? 60)}.`);
      } else if (e instanceof ApiFailure && e.field === 'startedAt') {
        go(2);
        setSendError(e.message);
      } else if (e instanceof ApiFailure && e.field === 'location') {
        go(1);
        setSendError(e.message);
      } else {
        setSendError(e instanceof Error ? e.message : 'Couldn’t send. Try again.');
      }
    } finally {
      setSending(false);
    }
  };

  const next = () => {
    if (step === 0) {
      if (!issue) return setIssueError('Choose the option closest to what you see.');
      return go(1);
    }
    if (step === 1) return go(2);
    if (step === 2) return send();
  };

  const color = issue ? issueMeta[issue].color : 'var(--ink)';

  if (step === 3 && result) {
    return <Success result={result} issue={issue} />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      {/* Header + progress */}
      <header className="sticky top-0 z-20 bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => go((step - 1) as Step)}
              aria-label="Previous step"
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-sunken"
            >
              <ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : (
            <Link href="/dashboard" aria-label="Cancel report" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-sunken">
              <XIcon className="h-5 w-5" aria-hidden="true" />
            </Link>
          )}
          <p className="flex-1 text-center font-body text-sm font-medium text-ink-muted">
            Step {step + 1} of 3
          </p>
          <span className="w-10" />
        </div>
        <div className="mx-auto flex max-w-xl gap-1.5 px-5 pb-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-line">
              <motion.span
                className="block h-full rounded-full bg-ink"
                initial={false}
                animate={{ width: i <= step ? '100%' : '0%' }}
                transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
              />
            </span>
          ))}
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 overflow-x-hidden px-5 pb-40">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction * 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -32 }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
          >
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink">{stepTitles[step]}</h1>

            {step === 0 && (
              <div className="mt-6">
                <OptionCards<IssueType>
                  label="Choose one"
                  hint="Pick what you see at home right now. You can add more details later."
                  value={issue}
                  error={issueError}
                  onChange={(v) => {
                    setIssue(v);
                    setIssueError(undefined);
                  }}
                  options={(['no_power', 'low_voltage', 'fluctuating'] as IssueType[]).map((v) => ({
                    value: v,
                    label: issueMeta[v].label,
                    description: issueMeta[v].description,
                    color: issueMeta[v].color,
                    icon: <IssueIcon issue={v} className="h-5 w-5" />,
                  }))}
                />
              </div>
            )}

            {step === 1 && (
              <div className="mt-2 space-y-4">
                {/* You already reported here: answer instead of reporting again */}
                {mine && (
                  <div className="rounded-lg border border-line-strong bg-canvas p-4">
                    <p className="font-body text-sm font-semibold text-ink">
                      You reported {issueMeta[mine.issue].label.toLowerCase()} near here {formatAgo(minutesSince(mine.lastConfirmedAt))}.
                    </p>
                    <p className="mt-0.5 font-body text-xs text-ink-muted">Is it still off? Answering updates that report instead of sending a new one.</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button size="sm" onClick={() => answerMine(false)} loading={sending}>
                        Still off
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => answerMine(true)} leading={<SunIcon className="h-4 w-4" aria-hidden="true" />}>
                        Light is back
                      </Button>
                    </div>
                  </div>
                )}

                <p className="font-body text-sm text-ink-muted">Move the map so the pin sits on your house or street.</p>

                {/* Shortcuts: saved places and landmark search */}
                {profile.places.length > 0 && (
                  <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
                    {profile.places.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => moveTo(p)}
                        className={cn(
                          'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 font-body text-sm font-medium',
                          distanceMeters(p, pos) < 30 ? 'bg-ink text-canvas' : 'border border-line-strong bg-surface text-ink hover:border-ink',
                        )}
                      >
                        <MapPinIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {placeName(p)}
                      </button>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <label className="sr-only" htmlFor="report-search">
                    Search a landmark or area
                  </label>
                  <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                  <input
                    id="report-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search a landmark, e.g. Odim Gate"
                    autoComplete="off"
                    className="h-11 w-full rounded-full border border-line bg-surface pl-10 pr-4 font-body text-sm text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none"
                  />
                  {query && results.length > 0 && (
                    <ul className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-lg bg-surface py-1 shadow-float">
                      {results.map((r) => (
                        <li key={`${r.type}-${r.id}`}>
                          <button
                            type="button"
                            onClick={() => {
                              moveTo(r);
                              setQuery('');
                            }}
                            className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-canvas"
                          >
                            <span className="font-body text-sm font-semibold text-ink">{r.name}</span>
                            <span className="font-body text-xs text-ink-muted">{r.detail}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="relative h-[42vh] min-h-[260px] overflow-hidden rounded-lg bg-sunken">
                  <LocationPicker value={pos} onChange={setPos} recenterKey={recenter} color={color} />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute right-3 top-3 shadow-float"
                    loading={locating}
                    onClick={() => findMe()}
                    leading={<LocateFixedIcon className="h-4 w-4" aria-hidden="true" />}
                  >
                    Use my location
                  </Button>
                  {device && (
                    <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-surface px-3 py-1 font-body text-xs text-ink-muted shadow-card">
                      GPS ±{Math.round(device.accuracy)} m
                    </span>
                  )}
                </div>

                {/* Area: our guess, or a quick choice when we're not sure */}
                {ctx && area && (
                  <div>
                    <p className="font-body text-sm font-medium text-ink">{ctx.confident || chosenArea ? 'Area' : 'Which area is this?'}</p>
                    {!ctx.confident && !chosenArea && (
                      <p className="mt-0.5 font-body text-xs text-status-low">This spot is near a boundary or your GPS is rough. Pick the area you’re in.</p>
                    )}
                    <div role="radiogroup" className="mt-2 flex flex-wrap gap-1.5">
                      {ctx.areas.map((a) => {
                        const active = a.slug === area.slug;
                        return (
                          <button
                            key={a.slug}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setChosenArea(a.slug)}
                            className={cn(
                              'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 font-body text-sm font-medium transition-colors',
                              active ? 'bg-ink text-canvas' : 'border border-line-strong bg-surface text-ink hover:border-ink',
                            )}
                          >
                            {active && <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                            {a.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Outages already reported nearby */}
                {ctx && ctx.nearby.length > 0 && (
                  <div className="rounded-md bg-canvas p-3">
                    <p className="flex items-center gap-1.5 font-body text-xs font-semibold uppercase tracking-wide text-ink-faint">
                      <UsersIcon className="h-3.5 w-3.5" aria-hidden="true" /> Already reported nearby
                    </p>
                    <ul className="mt-2 space-y-2">
                      {ctx.nearby.slice(0, 3).map((i) => (
                        <li key={i.id} className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: issueMeta[i.issue].color }}>
                            <IssueIcon issue={i.issue} className="h-3.5 w-3.5" />
                          </span>
                          <p className="min-w-0 flex-1 font-body text-sm text-ink">
                            {issueMeta[i.issue].label} · {i.areaName}
                            <span className="block font-body text-xs text-ink-muted">
                              {i.reporterCount} {i.reporterCount === 1 ? 'neighbour' : 'neighbours'} · {statusMeta[i.status].label}
                              {i.id === joining?.id && ' · your report joins this'}
                            </span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <TextField
                  label="Landmark or street"
                  hint="Helps the crew find the exact pole or transformer."
                  placeholder="e.g. Opposite the pharmacy on Odim Street"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  optional
                />
              </div>
            )}

            {step === 2 && (
              <div className="mt-6 space-y-6">
                <p className="-mt-3 font-body text-sm text-ink-muted">All optional — send now if you’re in a hurry.</p>
                <TextField
                  label="When did it start?"
                  hint="Roughly is fine — your best guess helps the forecast."
                  type="datetime-local"
                  value={startedAt}
                  max={maxTime}
                  onChange={(e) => setStartedAt(e.target.value)}
                />
                {issue !== 'no_power' && (
                  <TextField
                    label="Voltage reading"
                    hint="From your stabiliser or meter display, if you have one. Normal is about 230 V."
                    placeholder="e.g. 150"
                    inputMode="numeric"
                    value={voltage}
                    error={voltageError}
                    onChange={(e) => {
                      setVoltage(e.target.value.replace(/[^\d]/g, ''));
                      setVoltageError(undefined);
                    }}
                    trailing={<span className="pr-3 font-body text-sm text-ink-faint">volts</span>}
                    optional
                  />
                )}
                <TextArea
                  label="What did you notice?"
                  hint="A bang, sparks, a fallen wire — anything that helps EEDC find the fault."
                  placeholder="e.g. Heard a loud bang from the transformer, then everything went off"
                  value={note}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                  optional
                />
                <div>
                  <p className="flex items-baseline justify-between font-body text-sm font-medium text-ink">
                    Photo <span className="font-normal text-ink-faint">Coming soon</span>
                  </p>
                  <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-line-strong p-4 transition-colors hover:border-ink">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sunken">
                      <CameraIcon className="h-5 w-5 text-ink-muted" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-body text-sm text-ink">
                      {photo ?? 'Add a photo of the pole, wire or meter'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      onChange={(e) => setPhoto(e.target.files?.[0]?.name ?? null)}
                    />
                  </label>
                  <p className="mt-2 font-body text-xs text-ink-faint">Photos aren’t uploaded yet. Never stand under a fallen or sparking wire to take one.</p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Sticky action bar within thumb reach */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-4">
        <div className="mx-auto max-w-xl space-y-2">
          <AnimatePresence>
            {sendError && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="alert"
                className="flex items-start gap-2 rounded-md bg-canvas p-3 font-body text-sm text-ink"
              >
                <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-status-low" aria-hidden="true" />
                {sendError}
              </motion.p>
            )}
          </AnimatePresence>
          <Button full size="lg" loading={sending} onClick={next}>
            {step === 2 ? (sending ? 'Sending report…' : 'Send report') : 'Continue'}
          </Button>
          {step === 1 && (
            <Button full variant="ghost" onClick={send} disabled={sending || !issue}>
              Skip details and send now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

type Outcome = SubmitResult | { outcome: 'light_back' | 'still_off'; area: string };

function Success({ result, issue }: { result: Outcome; issue: IssueType | null }) {
  const label = issue ? issueMeta[issue].label.toLowerCase() : 'the problem';
  let title = 'Report sent';
  let body: React.ReactNode;
  switch (result.outcome) {
    case 'created': {
      const others = Math.max(0, result.incident.reporterCount - 1);
      body =
        others > 0 ? (
          <>
            You’re not alone — <span className="font-semibold text-ink">{others} {others === 1 ? 'neighbour' : 'neighbours'}</span> in{' '}
            {result.incident.areaName} reported {label} too. EEDC can see it now.
          </>
        ) : (
          <>Your report from {result.incident.areaName} is on EEDC’s map. We’ll tell you when they confirm the fault and when a crew is sent.</>
        );
      break;
    }
    case 'merged':
      title = 'Added to your report';
      body = <>You’d already reported this outage, so we updated that report instead of sending a duplicate. EEDC sees it’s still off.</>;
      break;
    case 'already_counted':
      title = 'Already counted';
      body = <>You reported this a few minutes ago — it’s still on EEDC’s map. We’ll ask you later whether your light is back.</>;
      break;
    case 'still_off':
      title = 'Thanks — still off';
      body = <>We’ve told EEDC the light is still off in {result.area}.</>;
      break;
    case 'light_back':
      title = 'Glad it’s back';
      body = <>We’ve closed your report. When enough neighbours say the same, the outage is marked restored.</>;
      break;
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-6 pb-[env(safe-area-inset-bottom)] text-center">
      <motion.span
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 16 }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-status-restored text-white"
      >
        {result.outcome === 'light_back' ? <SunIcon className="h-10 w-10" aria-hidden="true" /> : <CheckIcon className="h-10 w-10" strokeWidth={3} aria-hidden="true" />}
      </motion.span>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <h1 className="mt-8 font-display text-3xl font-bold tracking-tight text-ink">{title}</h1>
        <p className="mx-auto mt-3 max-w-[34ch] font-body text-base leading-body text-ink-muted">{body}</p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mt-10 flex w-full max-w-sm flex-col gap-2.5"
      >
        <ButtonLink href="/map" size="lg" full>
          See the live map
        </ButtonLink>
        <ButtonLink href="/dashboard" size="lg" variant="secondary" full>
          Back home
        </ButtonLink>
      </motion.div>
    </div>
  );
}
