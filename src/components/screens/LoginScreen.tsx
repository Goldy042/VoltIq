'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSignIn } from '@clerk/nextjs';
import { clerkMessage, goAfterAuth } from '@/components/auth/clerk';
import { ArrowLeftIcon, BuildingIcon, MailIcon } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import { PasswordField } from '@/components/ui/PasswordField';
import { TextField } from '@/components/ui/TextField';

type Mode = 'password' | 'code' | 'otp' | 'staff';

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function Divider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      <span className="font-body text-xs text-ink-faint">or</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Email-first sign-in: password, or a one-time code sent by email (free to send, unlike SMS). */
export function LoginScreen() {
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; code?: string }>({});
  const [pending, setPending] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  const switchMode = (m: Mode) => {
    setErrors({});
    setPending(false);
    if (m !== 'otp') setSecondFactor(false);
    setMode(m);
  };

  const { signIn } = useSignIn();
  // New device without MFA: Clerk asks for an emailed code after the password.
  const [secondFactor, setSecondFactor] = useState(false);

  const finish = async () => {
    if (signIn.status !== 'complete') return false;
    await signIn.finalize({ navigate: goAfterAuth() });
    return true;
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = {
      email: isEmail(email) ? undefined : 'Enter the email you signed up with.',
      password: password ? undefined : 'Enter your password.',
    };
    setErrors(next);
    if (next.email || next.password) return;
    setPending(true);
    const { error } = await signIn.password({ emailAddress: email.trim(), password });
    if (error) {
      setPending(false);
      const msg = clerkMessage(error);
      setErrors(error.code === 'form_identifier_not_found' ? { email: msg } : { password: msg });
      return;
    }
    if (await finish()) return;
    if (signIn.status === 'needs_second_factor' || signIn.status === 'needs_client_trust') {
      const sent = await signIn.mfa.sendEmailCode();
      setPending(false);
      if (sent.error) return setErrors({ password: clerkMessage(sent.error) });
      setSecondFactor(true);
      setCode('');
      setResendIn(30);
      setMode('otp');
      return;
    }
    setPending(false);
    setErrors({ password: 'This account needs a sign-in step we don’t support yet. Use “Email me a sign-in code”.' });
  };

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isEmail(email)) {
      setErrors({ email: 'Enter the email you signed up with.' });
      return;
    }
    setErrors({});
    setPending(true);
    const { error } = secondFactor ? await signIn.mfa.sendEmailCode() : await signIn.emailCode.sendCode({ emailAddress: email.trim() });
    setPending(false);
    if (error) {
      setErrors(mode === 'otp' ? { code: clerkMessage(error) } : { email: clerkMessage(error) });
      return;
    }
    setCode('');
    setResendIn(30);
    setMode('otp');
  };

  const verify = async (value = code) => {
    if (value.length < 6) {
      setErrors({ code: 'Enter all 6 digits.' });
      return;
    }
    setErrors({});
    setPending(true);
    const { error } = secondFactor ? await signIn.mfa.verifyEmailCode({ code: value }) : await signIn.emailCode.verifyCode({ code: value });
    if (error) {
      setPending(false);
      setErrors({ code: clerkMessage(error) });
      return;
    }
    if (!(await finish())) {
      setPending(false);
      setErrors({ code: 'That didn’t finish signing you in. Try again.' });
    }
  };

  const copy: Record<Mode, { title: string; intro: React.ReactNode }> = {
    password: { title: 'Welcome back', intro: 'Sign in to see the light at your places.' },
    code: { title: 'Sign in with a code', intro: 'No password needed. We’ll email you a 6-digit code.' },
    otp: {
      title: 'Check your email',
      intro: (
        <>
          We sent a code to <span className="font-semibold text-ink">{email.trim()}</span>.{' '}
          <button type="button" onClick={() => switchMode('code')} className="font-semibold text-accent hover:underline">
            Change
          </button>
        </>
      ),
    },
    staff: { title: 'EEDC staff sign-in', intro: 'Opens the Nsukka district dispatch console.' },
  };

  const emailField = (autoFocus = false) => (
    <TextField
      label={mode === 'staff' ? 'Work email' : 'Email'}
      hint={mode === 'staff' ? 'Your Enugu Electricity Distribution Company email.' : 'The email you signed up with.'}
      placeholder={mode === 'staff' ? 'name@enugudisco.com' : 'you@example.com'}
      type="email"
      inputMode="email"
      autoComplete={mode === 'staff' ? 'username' : 'email'}
      autoFocus={autoFocus}
      leading={<MailIcon className="h-5 w-5" />}
      value={email}
      error={errors.email}
      onChange={(e) => {
        setEmail(e.target.value);
        setErrors((er) => ({ ...er, email: undefined }));
      }}
    />
  );

  return (
    <AuthShell
      stepKey={mode}
      title={copy[mode].title}
      intro={copy[mode].intro}
      footer={
        mode === 'staff' ? null : (
          <div className="space-y-3">
            <p>
              New to VoltIq?{' '}
              <Link href="/signup" className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                Create an account
              </Link>
            </p>
            <p>
              <button type="button" onClick={() => switchMode('staff')} className="inline-flex items-center gap-1.5 font-medium text-ink-muted hover:text-ink">
                <BuildingIcon className="h-4 w-4" aria-hidden="true" />
                EEDC staff? Sign in here
              </button>
            </p>
          </div>
        )
      }
    >
      {mode !== 'password' && (
        <button
          type="button"
          onClick={() => switchMode(mode === 'otp' ? 'code' : 'password')}
          className="-ml-2 mb-6 inline-flex h-9 items-center gap-1 rounded-full px-2 font-body text-sm font-medium text-ink-muted hover:bg-sunken hover:text-ink"
        >
          <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
          {mode === 'otp' ? 'Back' : 'Back to sign in'}
        </button>
      )}

      {(mode === 'password' || mode === 'staff') && (
        <form onSubmit={submitPassword} noValidate className="space-y-5">
          {emailField()}
          <PasswordField
            label="Password"
            hint={mode === 'staff' ? 'Ask your district admin if you’ve lost access.' : 'At least 6 characters.'}
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            error={errors.password}
            onChange={(v) => {
              setPassword(v);
              setErrors((er) => ({ ...er, password: undefined }));
            }}
          />
          {mode === 'password' && (
            <div className="flex justify-end">
              <button type="button" onClick={() => switchMode('code')} className="font-body text-sm font-medium text-ink-muted hover:text-ink">
                Forgot password?
              </button>
            </div>
          )}
          <Button type="submit" size="lg" full loading={pending}>
            {pending ? (mode === 'staff' ? 'Opening console…' : 'Signing in…') : mode === 'staff' ? 'Open dispatch console' : 'Sign in'}
          </Button>
          {mode === 'password' && (
            <>
              <Divider />
              <Button
                variant="secondary"
                size="lg"
                full
                onClick={() => (isEmail(email) ? sendCode() : switchMode('code'))}
                leading={<MailIcon className="h-5 w-5" aria-hidden="true" />}
              >
                Email me a sign-in code
              </Button>
            </>
          )}
        </form>
      )}

      {mode === 'code' && (
        <form onSubmit={sendCode} noValidate className="space-y-5">
          {emailField(true)}
          <Button type="submit" size="lg" full loading={pending}>
            Send code
          </Button>
        </form>
      )}

      {mode === 'otp' && (
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
            {pending ? 'Signing in…' : 'Verify and sign in'}
          </Button>
          <p className="text-center font-body text-sm text-ink-muted">
            {resendIn > 0 ? (
              <>Resend code in 0:{String(resendIn).padStart(2, '0')}</>
            ) : (
              <button type="button" onClick={() => sendCode()} className="font-semibold text-accent hover:underline">
                Resend code
              </button>
            )}
          </p>
        </form>
      )}
    </AuthShell>
  );
}
