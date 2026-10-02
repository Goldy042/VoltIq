'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftIcon, CameraIcon, CheckIcon, LocateFixedIcon, MapPinIcon, XIcon } from 'lucide-react';
import { LocationPicker } from '@/components/map';
import { Button, ButtonLink } from '@/components/ui/Button';
import { OptionCards } from '@/components/ui/OptionCards';
import { TextField } from '@/components/ui/TextField';
import { TextArea } from '@/components/ui/TextArea';
import { IssueIcon } from '@/components/ui/Badges';
import {
  incidents,
  issueMeta,
  type IssueType,
} from '@/data/nsukka';
import { distanceMeters } from '@/lib/geo';
import { resolveArea } from '@/lib/address';
import { locateBest } from '@/lib/locate';
import { useProfile } from '@/lib/profile';

type Step = 0 | 1 | 2 | 3;

const stepTitles = ['What’s happening?', 'Where is it?', 'A few details'];

function nowLocalValue() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function ReportScreen({ initialIssue }: { initialIssue?: IssueType }) {
  const [step, setStep] = useState<Step>(initialIssue ? 1 : 0);
  const [direction, setDirection] = useState(1);
  const [issue, setIssue] = useState<IssueType | null>(initialIssue ?? null);
  const [issueError, setIssueError] = useState<string>();
  const { primary } = useProfile();
  const [pos, setPos] = useState({ lat: primary.lat, lng: primary.lng });
  const [recenter, setRecenter] = useState(0);
  const [locating, setLocating] = useState(false);
  const [landmark, setLandmark] = useState('');
  // Set after mount: server and browser timezones differ, which would break hydration.
  const [startedAt, setStartedAt] = useState('');
  const [maxTime, setMaxTime] = useState<string>();
  useEffect(() => {
    const now = nowLocalValue();
    setStartedAt(now);
    setMaxTime(now);
  }, []);
  const [voltage, setVoltage] = useState('');
  const [voltageError, setVoltageError] = useState<string>();
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const area = useMemo(() => resolveArea(pos).area, [pos]);
  const nearby = useMemo(
    () => incidents.find((i) => i.status !== 'restored' && distanceMeters(i, pos) < i.radius + 150),
    [pos],
  );

  const go = (next: Step) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const useMyLocation = () => {
    setLocating(true);
    locateBest({
      onFix: (fix) => {
        setPos({ lat: fix.lat, lng: fix.lng });
        setRecenter(Date.now());
      },
      onDone: () => setLocating(false),
      onError: () => setLocating(false),
    });
  };

  const next = () => {
    if (step === 0) {
      if (!issue) return setIssueError('Choose the option closest to what you see.');
      return go(1);
    }
    if (step === 1) return go(2);
    if (step === 2) {
      if (voltage && (Number(voltage) < 0 || Number(voltage) > 300)) {
        return setVoltageError('Enter a reading between 0 and 300 volts.');
      }
      setSending(true);
      window.setTimeout(() => {
        setSending(false);
        go(3);
      }, 900);
    }
  };

  const color = issue ? issueMeta[issue].color : 'var(--ink)';

  if (step === 3 && issue) {
    return <Success issue={issue} area={area.name} neighbours={nearby ? nearby.reports : 0} />;
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

      <main className="mx-auto w-full max-w-xl flex-1 overflow-x-hidden px-5 pb-32">
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
              <div className="mt-2">
                <p className="font-body text-sm text-ink-muted">Move the map so the pin sits on your house or street.</p>
                <div className="relative mt-4 h-[46vh] min-h-[280px] overflow-hidden rounded-lg bg-sunken">
                  <LocationPicker value={pos} onChange={setPos} recenterKey={recenter} color={color} />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute right-3 top-3 shadow-float"
                    loading={locating}
                    onClick={useMyLocation}
                    leading={<LocateFixedIcon className="h-4 w-4" aria-hidden="true" />}
                  >
                    Use my location
                  </Button>
                </div>

                <motion.div
                  key={area.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 flex items-center gap-3 rounded-md bg-canvas p-3"
                >
                  <MapPinIcon className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-body text-sm font-semibold text-ink">{area.name}</p>
                    <p className="font-body text-xs text-ink-muted">
                      {area.feeder}
                      {nearby && ` · ${nearby.reports} neighbours already reported here`}
                    </p>
                  </div>
                </motion.div>

                <TextField
                  className="mt-5"
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
                  onChange={(e) => setNote(e.target.value)}
                  optional
                />
                <div>
                  <p className="flex items-baseline justify-between font-body text-sm font-medium text-ink">
                    Photo <span className="font-normal text-ink-faint">Optional</span>
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
                  <p className="mt-2 font-body text-xs text-ink-faint">Never stand under a fallen or sparking wire to take a photo.</p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Sticky action bar within thumb reach */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-4">
        <div className="mx-auto max-w-xl">
          <Button full size="lg" loading={sending} onClick={next}>
            {step === 2 ? (sending ? 'Sending report…' : 'Send report') : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Success({ issue, area, neighbours }: { issue: IssueType; area: string; neighbours: number }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-6 pb-[env(safe-area-inset-bottom)] text-center">
      <motion.span
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 16 }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-status-restored text-white"
      >
        <CheckIcon className="h-10 w-10" strokeWidth={3} aria-hidden="true" />
      </motion.span>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <h1 className="mt-8 font-display text-3xl font-bold tracking-tight text-ink">Report sent</h1>
        <p className="mx-auto mt-3 max-w-[34ch] font-body text-base leading-body text-ink-muted">
          {neighbours > 0 ? (
            <>
              You’re not alone — <span className="font-semibold text-ink">{neighbours} neighbours</span> in {area} reported{' '}
              {issueMeta[issue].label.toLowerCase()} too. EEDC can see it on their map now.
            </>
          ) : (
            <>Your report from {area} is on the map. We’ll tell you when EEDC confirms the fault and when a crew is on the way.</>
          )}
        </p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mt-10 flex w-full max-w-sm flex-col gap-2.5"
      >
        <ButtonLink href="/map" size="lg" full>
          See it on the live map
        </ButtonLink>
        <ButtonLink href="/dashboard" size="lg" variant="secondary" full>
          Back home
        </ButtonLink>
      </motion.div>
    </div>
  );
}
