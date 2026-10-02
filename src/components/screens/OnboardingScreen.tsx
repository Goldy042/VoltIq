'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  BellRingIcon,
  CheckIcon,
  MapPinnedIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  ZapIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IssueIcon } from '@/components/ui/Badges';
import { AlertPrefsForm } from '@/components/places/AlertPrefsForm';
import { PlacePicker } from '@/components/places/PlacePicker';
import { areaById, incidents, issueMeta, predictions } from '@/data/nsukka';
import { describeLocation } from '@/lib/address';
import { placeName, useProfile, type SavedPlace } from '@/lib/profile';
import { useToast } from '@/components/ui/Toast';

type Step = 0 | 1 | 2 | 3;
const ease = [0.23, 1, 0.32, 1] as const;

const promises = [
  { icon: MapPinnedIcon, title: 'Save your places', body: 'Home, hostel or shop. No street name needed, a landmark is enough.' },
  { icon: SparklesIcon, title: 'Hear before it happens', body: 'We warn you hours before the AI expects your light to go.' },
  { icon: ZapIcon, title: 'Report in one tap', body: 'Your neighbours’ reports and yours go straight to EEDC.' },
];

export function OnboardingScreen() {
  const router = useRouter();
  const { profile, savePlace, removePlace, update } = useProfile();
  const [step, setStep] = useState<Step>(0);
  const [dir, setDir] = useState(1);
  const [editing, setEditing] = useState<SavedPlace | 'new' | null>(profile.places.length ? null : 'new');
  const first = profile.name.split(' ')[0] || 'there';
  // Nothing saved yet: go straight to the picker rather than an empty list.
  useEffect(() => {
    if (!profile.places.length && editing === null) setEditing('new');
  }, [profile.places.length, editing]);

  const go = (s: Step) => {
    setDir(s > step ? 1 : -1);
    setStep(s);
    window.scrollTo({ top: 0 });
  };

  const toast = useToast();
  const [finishing, setFinishing] = useState(false);
  const fail = (e: unknown) => toast({ title: 'Couldn’t save', body: e instanceof Error ? e.message : 'Try again.', color: 'var(--status-out)' });

  const finish = async () => {
    setFinishing(true);
    try {
      await update({ onboarded: true });
      router.replace('/dashboard');
      router.refresh();
    } catch (e) {
      setFinishing(false);
      fail(e);
    }
  };

  const showBar = !(step === 1 && editing);

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="sticky top-0 z-20 bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-3">
          {step > 0 && step < 3 ? (
            <button
              type="button"
              onClick={() => (step === 1 && editing && profile.places.length ? setEditing(null) : go((step - 1) as Step))}
              aria-label="Back"
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-sunken"
            >
              <ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : (
            <span className="w-10" />
          )}
          <p className="flex-1 text-center font-body text-sm font-medium text-ink-muted">
            {step === 0 ? 'Welcome' : step === 3 ? 'All set' : `Step ${step} of 2`}
          </p>
          {step === 2 ? (
            <button type="button" onClick={() => go(3)} className="h-10 rounded-full px-3 font-body text-sm font-medium text-ink-muted hover:bg-sunken">
              Skip
            </button>
          ) : (
            <span className="w-10" />
          )}
        </div>
        <div className="mx-auto flex max-w-xl gap-1.5 px-5 pb-3" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-line">
              <motion.span
                className="block h-full rounded-full bg-ink"
                initial={false}
                animate={{ width: i <= step ? '100%' : '0%' }}
                transition={{ duration: 0.35, ease }}
              />
            </span>
          ))}
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 overflow-x-hidden px-5 pb-32">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={`${step}-${editing ? 'edit' : 'list'}`}
            initial={{ opacity: 0, x: dir * 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -32 }}
            transition={{ duration: 0.24, ease }}
          >
            {step === 0 && (
              <div className="pt-6">
                <motion.span
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                  className="flex h-16 w-16 items-center justify-center rounded-lg bg-ink"
                >
                  <ZapIcon className="h-8 w-8 fill-volt text-volt" aria-hidden="true" />
                </motion.span>
                <h1 className="mt-6 font-display text-4xl font-bold leading-tight tracking-tight text-ink">
                  Welcome, {first}.
                </h1>
                <p className="mt-3 font-body text-lg leading-body text-ink-muted">
                  Two quick steps and VoltIq starts watching the light at your places.
                </p>
                <ul className="mt-8 space-y-5">
                  {promises.map((p, i) => (
                    <motion.li
                      key={p.title}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.1, duration: 0.45, ease }}
                      className="flex gap-4"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-canvas text-ink">
                        <p.icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span>
                        <span className="block font-display text-lg font-bold tracking-tight text-ink">{p.title}</span>
                        <span className="mt-0.5 block font-body text-sm leading-snug text-ink-muted">{p.body}</span>
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            {step === 1 && editing && (
              <div className="pt-4">
                <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
                  {profile.places.length ? 'Add another place' : 'Where do you stay?'}
                </h1>
                <p className="mt-2 font-body text-base text-ink-muted">
                  We use this to tell you about your light, and to send crews to the right gate.
                </p>
                <div className="mt-6">
                  <PlacePicker
                    initial={editing === 'new' ? undefined : editing}
                    defaultLabel={profile.places.length ? 'hostel' : 'home'}
                    saveText={editing === 'new' ? 'Save this place' : 'Save changes'}
                    onSave={(p) => {
                      setEditing(null);
                      savePlace(p).catch((e) => {
                        fail(e);
                        setEditing(p);
                      });
                    }}
                    onCancel={profile.places.length ? () => setEditing(null) : undefined}
                  />
                </div>
              </div>
            )}

            {step === 1 && !editing && (
              <div className="pt-4">
                <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Your places</h1>
                <p className="mt-2 font-body text-base text-ink-muted">
                  Add every place where the light matters to you. You can change these any time.
                </p>
                <ul className="mt-6 space-y-2.5">
                  <AnimatePresence initial={false}>
                    {profile.places.map((p) => (
                      <motion.li
                        key={p.id}
                        layout
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                      >
                        <PlaceRow place={p} onEdit={() => setEditing(p)} onRemove={() => removePlace(p.id).catch(fail)} />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
                <button
                  type="button"
                  onClick={() => setEditing('new')}
                  className="mt-3 flex w-full items-center gap-3 rounded-lg border border-dashed border-line-strong p-4 text-left transition-colors hover:border-ink"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-canvas">
                    <PlusIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-body text-sm font-semibold text-ink">Add another place</span>
                    <span className="block font-body text-xs text-ink-muted">Your hostel, shop or family house</span>
                  </span>
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="pt-4">
                <h1 className="font-display text-3xl font-bold tracking-tight text-ink">How should we alert you?</h1>
                <p className="mt-2 font-body text-base text-ink-muted">
                  Email and app notifications are free. Turn on SMS only if you’re often without data.
                </p>
                <div className="-mx-3 mt-6">
                  <AlertPrefsForm value={profile.alerts} onChange={(alerts) => update({ alerts }).catch(fail)} />
                </div>
              </div>
            )}

            {step === 3 && <Done places={profile.places} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {showBar && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-4">
          <div className="mx-auto max-w-xl">
            {step === 0 && (
              <Button full size="lg" onClick={() => go(1)}>
                Let’s set up
              </Button>
            )}
            {step === 1 && (
              <Button full size="lg" disabled={!profile.places.length} onClick={() => go(2)}>
                Continue
              </Button>
            )}
            {step === 2 && (
              <Button full size="lg" onClick={() => go(3)} leading={<BellRingIcon className="h-5 w-5" aria-hidden="true" />}>
                Save alert settings
              </Button>
            )}
            {step === 3 && (
              <Button full size="lg" onClick={finish} loading={finishing}>
                Go to my dashboard
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PlaceRow({ place, onEdit, onRemove }: { place: SavedPlace; onEdit: () => void; onRemove: () => void }) {
  const d = describeLocation(place);
  return (
    <div className="flex items-center gap-3 rounded-lg bg-canvas p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-canvas">
        <MapPinnedIcon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-body text-sm font-semibold text-ink">{placeName(place)}</p>
        <p className="truncate font-body text-xs text-ink-muted">{d.summary}</p>
        <p className="truncate font-body text-xs text-ink-faint">
          {d.area.feeder} · Band {d.area.band}
        </p>
      </div>
      <button type="button" onClick={onEdit} aria-label={`Edit ${placeName(place)}`} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink">
        <PencilIcon className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={onRemove} aria-label={`Remove ${placeName(place)}`} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-sunken hover:text-status-out">
        <Trash2Icon className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Finish line: show right away that the app is already watching their places. */
function Done({ places }: { places: SavedPlace[] }) {
  return (
    <div className="pt-8 text-center">
      <motion.span
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 16 }}
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-status-restored text-white"
      >
        <CheckIcon className="h-10 w-10" strokeWidth={3} aria-hidden="true" />
      </motion.span>
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-ink">You’re all set</h1>
      <p className="mt-2 font-body text-base text-ink-muted">Here’s what’s happening at your places right now.</p>

      <ul className="mt-8 space-y-2.5 text-left">
        {places.map((p, i) => {
          const area = areaById[p.areaId];
          const live = incidents.find((x) => x.areaId === p.areaId && x.status !== 'restored');
          const forecast = predictions.find((x) => x.areaId === p.areaId || x.area.includes(area.name));
          return (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.1, duration: 0.4, ease }}
              className="rounded-lg bg-canvas p-4"
            >
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {placeName(p)} · {area.name}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: live ? issueMeta[live.issue].color : 'var(--status-restored)' }}
                >
                  {live ? <IssueIcon issue={live.issue} className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" strokeWidth={3} aria-hidden="true" />}
                </span>
                <p className="font-body text-sm text-ink">
                  {live ? (
                    <>
                      <span className="font-semibold">{issueMeta[live.issue].label}</span> · {live.reports} neighbours reported
                    </>
                  ) : (
                    <span className="font-semibold">Light is on</span>
                  )}
                </p>
              </div>
              {forecast && (
                <p className="mt-2 flex items-center gap-1.5 font-body text-sm font-medium text-status-predicted">
                  <SparklesIcon className="h-4 w-4" aria-hidden="true" />
                  Possible outage {forecast.window.toLowerCase()} ({forecast.confidence}%)
                </p>
              )}
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
