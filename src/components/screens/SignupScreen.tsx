'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { LocateFixedIcon, MailIcon, PhoneIcon, UserIcon } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { TextField } from '@/components/ui/TextField';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { NSUKKA_BOUNDS, areas, nearestArea } from '@/data/nsukka';

interface Form {
  name: string;
  phone: string;
  email: string;
  password: string;
  area: string;
  address: string;
}

export function SignupScreen() {
  const router = useRouter();
  const [form, setForm] = useState<Form>({ name: '', phone: '', email: '', password: '', area: '', address: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [sms, setSms] = useState(true);
  const [locating, setLocating] = useState(false);
  const [pending, setPending] = useState(false);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const [w, s, e, n] = NSUKKA_BOUNDS;
        if (coords.longitude < w || coords.longitude > e || coords.latitude < s || coords.latitude > n) {
          setErrors((er) => ({ ...er, area: 'You seem to be outside Nsukka — choose your area from the list.' }));
          return;
        }
        const a = nearestArea({ lat: coords.latitude, lng: coords.longitude });
        setForm((f) => ({ ...f, area: a.id }));
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 6000 },
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (form.name.trim().length < 2) next.name = 'Enter your name.';
    if (form.phone.replace(/\D/g, '').length < 10) next.phone = 'Enter a Nigerian mobile number, e.g. 0803 000 0000.';
    if (!form.email.includes('@')) next.email = 'Enter a valid email address.';
    if (form.password.length < 6) next.password = 'Use at least 6 characters.';
    if (!form.area) next.area = 'Choose the area you live in.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setPending(true);
    window.setTimeout(() => router.push('/dashboard'), 700);
  };

  return (
    <AuthShell
      title="Join your street"
      intro="Report outages in seconds and get warned before the light goes in your area."
      footer={
        <p>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-6">
        <TextField
          label="Full name"
          hint="Shown only to EEDC, never on the public map."
          placeholder="e.g. Chiamaka Nnaji"
          autoComplete="name"
          leading={<UserIcon className="h-5 w-5" />}
          value={form.name}
          error={errors.name}
          onChange={set('name')}
        />
        <TextField
          label="Phone number"
          hint="We send outage warnings here by SMS."
          placeholder="0803 000 0000"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          leading={<PhoneIcon className="h-5 w-5" />}
          value={form.phone}
          error={errors.phone}
          onChange={set('phone')}
        />
        <TextField
          label="Email"
          hint="For your account and repair updates."
          placeholder="you@example.com"
          type="email"
          autoComplete="email"
          leading={<MailIcon className="h-5 w-5" />}
          value={form.email}
          error={errors.email}
          onChange={set('email')}
        />
        <TextField
          label="Password"
          hint="At least 6 characters."
          placeholder="Create a password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          error={errors.password}
          onChange={set('password')}
        />
        <div>
          <Select
            label="Your area"
            hint="Forecasts and alerts are sent per area and feeder."
            placeholder="Choose your area in Nsukka"
            options={areas.map((a) => ({ value: a.id, label: a.name }))}
            value={form.area}
            error={errors.area}
            onChange={set('area')}
          />
          <Button
            size="sm"
            variant="ghost"
            className="mt-1 -ml-3"
            loading={locating}
            onClick={locate}
            leading={<LocateFixedIcon className="h-4 w-4" aria-hidden="true" />}
          >
            Detect from my location
          </Button>
        </div>
        <TextField
          label="Street or landmark"
          hint="Helps place your reports accurately. Never shown publicly."
          placeholder="e.g. Odim Street, near the junction"
          autoComplete="street-address"
          value={form.address}
          onChange={set('address')}
          optional
        />

        <button
          type="button"
          role="switch"
          aria-checked={sms}
          onClick={() => setSms((s) => !s)}
          className="flex w-full items-center justify-between gap-4 rounded-lg bg-canvas p-4 text-left"
        >
          <span>
            <span className="block font-body text-sm font-semibold text-ink">SMS outage warnings</span>
            <span className="mt-0.5 block font-body text-xs text-ink-muted">Get a text when the AI expects your light to go.</span>
          </span>
          <span className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', sms ? 'bg-status-restored' : 'bg-line-strong')}>
            <motion.span
              className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-card"
              animate={{ left: sms ? 22 : 2 }}
              transition={{ type: 'spring', stiffness: 600, damping: 34 }}
            />
          </span>
        </button>

        <Button type="submit" size="lg" full loading={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  );
}
