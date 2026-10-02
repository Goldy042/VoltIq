'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CopyIcon,
  LogOutIcon,
  MailIcon,
  MapPinnedIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  StarIcon,
  Trash2Icon,
  UserIcon,
  XIcon,
} from 'lucide-react';
import { AppHeader } from '@/components/app/AppHeader';
import { AppTabBar } from '@/components/app/AppTabBar';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { cn } from '@/components/ui/cn';
import { useToast } from '@/components/ui/Toast';
import { AlertPrefsForm } from '@/components/places/AlertPrefsForm';
import { PlacePicker } from '@/components/places/PlacePicker';
import { myReports } from '@/data/nsukka';
import { describeLocation } from '@/lib/address';
import { placeName, useProfile, type SavedPlace } from '@/lib/profile';

const ease = [0.23, 1, 0.32, 1] as const;

export function ProfileScreen() {
  const toast = useToast();
  const { profile, primary, update, savePlace, removePlace, setPrimary } = useProfile();
  const [details, setDetails] = useState({ name: profile.name, phone: profile.phone });
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [editing, setEditing] = useState<SavedPlace | 'new' | null>(null);

  // Pick up the saved profile when it changes.
  useEffect(() => {
    setDetails({ name: profile.name, phone: profile.phone });
  }, [profile.name, profile.phone]);

  const dirty = details.name !== profile.name || details.phone !== profile.phone;
  const initials = profile.name.split(' ').map((p) => p[0]).slice(0, 2).join('');
  const confirmed = myReports.filter((r) => r.status !== 'reported').length;

  const saveDetails = () => {
    const next: typeof errors = {};
    if (details.name.trim().length < 2) next.name = 'Enter your name.';
    if (details.phone.trim() && details.phone.replace(/\D/g, '').length < 10) {
      next.phone = 'Enter a Nigerian mobile number, e.g. 0803 000 0000, or leave it empty.';
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    update({ name: details.name.trim(), phone: details.phone.trim() })
      .then(() => toast({ title: 'Details saved' }))
      .catch((e: Error) => toast({ title: 'Couldn’t save', body: e.message }));
  };

  return (
    <div className="min-h-dvh bg-canvas pb-28 lg:pb-16">
      <AppHeader />

      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-6 lg:px-5">
        {/* Identity */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease }}
          className="flex items-center gap-4 rounded-xl bg-surface p-5 shadow-card"
        >
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ink font-display text-xl font-bold text-canvas">
            {initials}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-bold tracking-tight text-ink">{profile.name}</h1>
            <p className="truncate font-body text-sm text-ink-muted">
              {placeName(primary)} · {describeLocation(primary).area.name}
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#e6f5ed] px-2.5 py-1 font-body text-xs font-semibold text-status-restored">
              <ShieldCheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Trusted reporter · {confirmed} of {myReports.length} reports confirmed
            </p>
          </div>
        </motion.section>

        {/* Places */}
        <Section title="Your places" hint="Alerts and reports use these. The default place is the one your dashboard shows.">
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {profile.places.map((p) => {
                const d = describeLocation(p);
                const isPrimary = p.id === primary.id;
                return (
                  <motion.li
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="rounded-lg bg-canvas p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-canvas">
                        <MapPinnedIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 font-body text-sm font-semibold text-ink">
                          {placeName(p)}
                          {isPrimary && (
                            <span className="rounded-full bg-ink px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-wide text-canvas">
                              Default
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 font-body text-sm text-ink-muted">{d.summary}</p>
                        {p.directions && <p className="mt-0.5 font-body text-xs text-ink-faint">“{p.directions}”</p>}
                        <p className="mt-1.5 font-body text-xs text-ink-faint">
                          {d.area.feeder} · Band {d.area.band} · <span className="tabular-nums">{p.plusCode}</span>
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                      {!isPrimary && (
                        <SmallAction icon={<StarIcon className="h-3.5 w-3.5" />} onClick={() => setPrimary(p.id).catch((e: Error) => toast({ title: 'Couldn’t save', body: e.message }))}>
                          Make default
                        </SmallAction>
                      )}
                      <SmallAction icon={<PencilIcon className="h-3.5 w-3.5" />} onClick={() => setEditing(p)}>
                        Edit
                      </SmallAction>
                      <SmallAction
                        icon={<CopyIcon className="h-3.5 w-3.5" />}
                        onClick={() => navigator.clipboard?.writeText(p.plusCode).then(() => toast({ title: 'Plus code copied', body: p.plusCode }))}
                      >
                        Copy code
                      </SmallAction>
                      {profile.places.length > 1 && (
                        <SmallAction danger icon={<Trash2Icon className="h-3.5 w-3.5" />} onClick={() => removePlace(p.id).catch((e: Error) => toast({ title: 'Couldn’t remove', body: e.message }))}>
                          Remove
                        </SmallAction>
                      )}
                    </div>
                  </motion.li>
                );
              })}
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
              <span className="block font-body text-sm font-semibold text-ink">Add a place</span>
              <span className="block font-body text-xs text-ink-muted">Hostel, shop, family house</span>
            </span>
          </button>
        </Section>

        {/* Alerts */}
        <Section title="Alerts" hint="Changes save straight away.">
          <div className="-mx-3">
            <AlertPrefsForm value={profile.alerts} onChange={(alerts) => update({ alerts }).catch((e: Error) => toast({ title: 'Couldn’t save', body: e.message }))} />
          </div>
        </Section>

        {/* Details */}
        <Section title="Your details" hint="EEDC sees your name, and your phone if you add one, only when a crew needs to reach you.">
          <div className="space-y-5">
            <TextField
              label="Full name"
              hint="Never shown on the public map."
              placeholder="e.g. Chiamaka Nnaji"
              leading={<UserIcon className="h-5 w-5" />}
              value={details.name}
              error={errors.name}
              onChange={(e) => setDetails((d) => ({ ...d, name: e.target.value }))}
            />
            <TextField
              label="Phone number"
              hint="Lets a crew call if they can’t find your gate. Needed for SMS alerts."
              optional
              placeholder="0803 000 0000"
              type="tel"
              inputMode="tel"
              leading={<PhoneIcon className="h-5 w-5" />}
              value={details.phone}
              error={errors.phone}
              onChange={(e) => setDetails((d) => ({ ...d, phone: e.target.value }))}
            />
            <TextField
              label="Email"
              hint="You sign in with this. Changing it isn’t available yet."
              type="email"
              leading={<MailIcon className="h-5 w-5" />}
              value={profile.email}
              readOnly
              disabled
            />
            <Button full size="lg" disabled={!dirty} onClick={saveDetails}>
              {dirty ? 'Save details' : 'Saved'}
            </Button>
          </div>
        </Section>

        {/* Account */}
        <Section title="Account" hint="">
          <div className="space-y-1">
            <Link href="/onboarding" className="flex items-center gap-3 rounded-lg p-3 font-body text-sm font-semibold text-ink hover:bg-canvas">
              <RotateCcwIcon className="h-5 w-5 text-ink-muted" aria-hidden="true" />
              Run setup again
            </Link>
            <Link href="/login" className="flex items-center gap-3 rounded-lg p-3 font-body text-sm font-semibold text-status-out hover:bg-canvas">
              <LogOutIcon className="h-5 w-5" aria-hidden="true" />
              Sign out
            </Link>
          </div>
        </Section>
      </main>

      {/* Add / edit place sheet */}
      <AnimatePresence>
        {editing && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="place-sheet-title"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-xl bg-surface px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-5 sm:max-w-lg sm:rounded-xl"
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 id="place-sheet-title" className="font-display text-xl font-bold tracking-tight text-ink">
                  {editing === 'new' ? 'Add a place' : `Edit ${placeName(editing)}`}
                </h2>
                <button type="button" aria-label="Close" onClick={() => setEditing(null)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-sunken">
                  <XIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <PlacePicker
                initial={editing === 'new' ? undefined : editing}
                defaultLabel={editing === 'new' ? 'hostel' : undefined}
                saveText={editing === 'new' ? 'Save place' : 'Save changes'}
                onSave={(p) => {
                  const added = editing === 'new';
                  setEditing(null);
                  savePlace(p)
                    .then(() => toast({ title: added ? 'Place added' : 'Place updated', body: describeLocation(p).summary }))
                    .catch((e: Error) => {
                      toast({ title: 'Couldn’t save', body: e.message });
                      setEditing(added ? 'new' : p);
                    });
                }}
                onCancel={() => setEditing(null)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AppTabBar />
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.45, ease }}
      className="rounded-xl bg-surface p-5 shadow-card"
    >
      <h2 className="font-display text-xl font-bold tracking-tight text-ink">{title}</h2>
      {hint && <p className="mt-0.5 font-body text-sm text-ink-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </motion.section>
  );
}

function SmallAction({
  icon,
  onClick,
  children,
  danger = false,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full px-3 font-body text-xs font-semibold transition-colors hover:bg-sunken',
        danger ? 'text-status-out' : 'text-ink',
      )}
    >
      <span aria-hidden="true">{icon}</span>
      {children}
    </button>
  );
}
