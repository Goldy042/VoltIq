'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSignUp } from '@clerk/nextjs';
import { clerkMessage, goAfterAuth } from '@/components/auth/clerk';
import { ArrowLeftIcon, MailIcon, ShieldCheckIcon, UserIcon } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import { PasswordField } from '@/components/ui/PasswordField';
import { PhoneField, isNigerianMobile } from '@/components/ui/PhoneField';
import { TextField } from '@/components/ui/TextField';

interface Form {
  name: string;
  email: string;
  phone: string;
  password: string;
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const pretty = (d: string) => (d ? `+234 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : '');

/**
 * Account basics, then an email check. Email is free to send, so it carries
 * verification and alerts; a phone number is optional, for crews to call.
 * One verified email per reporter is the first line of defence against fake reports.
 */
export function SignupScreen() {
  const { signUp } = useSignUp();
  const [stage, setStage] = useState<'details' | 'verify'>('details');
  const [form, setForm] = useState<Form>({ name: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof Form | 'code', string>>>({});
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  const set = <K extends keyof Form>(key: K) => (value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const submitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (form.name.trim().length < 2) next.name = 'Enter your name as people know you.';
    if (!isEmail(form.email)) next.email = 'Enter a valid email, e.g. you@example.com.';
    if (form.phone && !isNigerianMobile(form.phone)) next.phone = 'Enter the 10 digits after +234, or leave it empty.';
    if (form.password.length < 8) next.password = 'Use at least 8 characters.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setPending(true);
    const [firstName, ...rest] = form.name.trim().split(/\s+/);
    const created = await signUp.password({
      emailAddress: form.email.trim(),
      password: form.password,
      firstName,
      lastName: rest.join(' ') || undefined,
      unsafeMetadata: form.phone ? { phone: pretty(form.phone) } : undefined,
      legalAccepted: true,
    });
    if (created.error) {
      setPending(false);
      const msg = clerkMessage(created.error);
      const code = created.error.code ?? '';
      if (code.includes('password')) setErrors({ password: msg });
      else setErrors({ email: msg });
      return;
    }
    const sent = await signUp.verifications.sendEmailCode();
    setPending(false);
    if (sent.error) return setErrors({ email: clerkMessage(sent.error) });
    setCode('');
    setResendIn(30);
    setStage('verify');
  };

  const verify = async (value = code) => {
    if (value.length < 6) {
      setErrors({ code: 'Enter all 6 digits.' });
      return;
    }
    setPending(true);
    const { error } = await signUp.verifications.verifyEmailCode({ code: value });
    if (error) {
      setPending(false);
      return setErrors({ code: clerkMessage(error) });
    }
    if (signUp.status !== 'complete') {
      setPending(false);
      return setErrors({ code: 'Almost there, but your account isn’t finished. Go back and check your details.' });
    }
    // /auth/continue creates the VoltIq account and sends them to onboarding.
    await signUp.finalize({ navigate: goAfterAuth() });
  };

  const resend = async () => {
    const { error } = await signUp.verifications.sendEmailCode();
    if (error) return setErrors({ code: clerkMessage(error) });
    setResendIn(30);
  };

  if (stage === 'verify') {
    return (
      <AuthShell
        stepKey="verify"
        title="Check your email"
        intro={
          <>
            We sent a 6-digit code to <span className="font-semibold text-ink">{form.email.trim()}</span>.
          </>
        }
      >
        <button
          type="button"
          onClick={() => setStage('details')}
          className="-ml-2 mb-6 inline-flex h-9 items-center gap-1 rounded-full px-2 font-body text-sm font-medium text-ink-muted hover:bg-sunken hover:text-ink"
        >
          <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
          Change email
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
          noValidate
          className="space-y-6"
        >
          <OtpInput
            label="6-digit code"
            hint="Check your spam folder if it isn’t there in a minute."
            value={code}
            error={errors.code}
            onChange={(c) => {
              setCode(c);
              setErrors({});
            }}
            onComplete={verify}
          />
          <Button type="submit" size="lg" full loading={pending}>
            {pending ? 'Verifying…' : 'Verify and continue'}
          </Button>
          <p className="text-center font-body text-sm text-ink-muted">
            {resendIn > 0 ? (
              <>Resend code in 0:{String(resendIn).padStart(2, '0')}</>
            ) : (
              <button type="button" onClick={resend} className="font-semibold text-accent hover:underline">
                Resend code
              </button>
            )}
          </p>
          <p className="flex items-start gap-2 rounded-md bg-canvas p-3 font-body text-xs leading-snug text-ink-muted">
            <ShieldCheckIcon className="mt-px h-4 w-4 shrink-0 text-status-restored" aria-hidden="true" />
            One verified account per person keeps reports honest, so EEDC can trust what the map shows.
          </p>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      stepKey="details"
      title="Join your street"
      intro="Report outages in seconds and hear first when the light is about to go."
      footer={
        <p>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submitDetails} noValidate className="space-y-5">
        <TextField
          label="Full name"
          hint="Only EEDC sees this, never the public map."
          placeholder="e.g. Chiamaka Nnaji"
          autoComplete="name"
          leading={<UserIcon className="h-5 w-5" />}
          value={form.name}
          error={errors.name}
          onChange={(e) => set('name')(e.target.value)}
        />
        <TextField
          label="Email"
          hint="We’ll send a code to check it’s yours, then outage alerts."
          placeholder="you@example.com"
          type="email"
          inputMode="email"
          autoComplete="email"
          leading={<MailIcon className="h-5 w-5" />}
          value={form.email}
          error={errors.email}
          onChange={(e) => set('email')(e.target.value)}
        />
        <PasswordField
          label="Password"
          hint="At least 8 characters. Mixing letters and numbers makes it stronger."
          placeholder="Create a password"
          autoComplete="new-password"
          value={form.password}
          error={errors.password}
          onChange={set('password')}
          meter
        />
        <PhoneField
          label="Phone number"
          hint="Only so an EEDC crew can call if they can’t find your gate."
          value={form.phone}
          error={errors.phone}
          onChange={set('phone')}
          optional
        />
        {/* Clerk's bot check renders here when it decides a visitor needs one. */}
        <div id="clerk-captcha" />
        <Button type="submit" size="lg" full loading={pending}>
          {pending ? 'Sending code…' : 'Continue'}
        </Button>
        <p className="text-center font-body text-xs leading-snug text-ink-faint">
          By continuing you agree to the{' '}
          <a href="#terms" className="underline underline-offset-2 hover:text-ink">
            terms
          </a>{' '}
          and{' '}
          <a href="#privacy" className="underline underline-offset-2 hover:text-ink">
            privacy policy
          </a>
          . Next we’ll check your email, then save your places.
        </p>
      </form>
    </AuthShell>
  );
}
