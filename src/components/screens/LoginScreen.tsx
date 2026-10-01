'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EyeIcon, EyeOffIcon, MailIcon } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

type Role = 'citizen' | 'eedc';

export function LoginScreen() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('citizen');
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ id?: string; password?: string }>({});
  const [pending, setPending] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const isPhone = /^\+?\d[\d\s]{9,}$/.test(id.trim());
    if (!id.includes('@') && !isPhone) next.id = 'Enter your email or an 11-digit phone number.';
    if (password.length < 6) next.password = 'Your password is at least 6 characters.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setPending(true);
    window.setTimeout(() => router.push(role === 'eedc' ? '/operator' : '/dashboard'), 600);
  };

  return (
    <AuthShell
      title="Welcome back"
      intro="Sign in to see your area’s light status, your reports and outage forecasts for your street."
      footer={
        <p>
          New to VoltIq?{' '}
          <Link href="/signup" className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            Create an account
          </Link>{' '}
          or{' '}
          <Link href="/report" className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            report without one
          </Link>
          .
        </p>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-6">
        <SegmentedControl<Role>
          label="I am signing in as"
          hint={role === 'eedc' ? 'Opens the EEDC dispatch console.' : 'Opens your neighbourhood dashboard.'}
          value={role}
          onChange={setRole}
          options={[
            { value: 'citizen', label: 'Resident' },
            { value: 'eedc', label: 'EEDC staff' },
          ]}
        />
        <TextField
          label="Email or phone"
          hint="Use the email or phone number you signed up with."
          placeholder={role === 'eedc' ? 'name@enugudisco.com' : 'you@example.com or 0803 000 0000'}
          autoComplete="username"
          leading={<MailIcon className="h-5 w-5" />}
          value={id}
          error={errors.id}
          onChange={(e) => setId(e.target.value)}
        />
        <TextField
          label="Password"
          hint="At least 6 characters."
          placeholder="Enter your password"
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          error={errors.password}
          onChange={(e) => setPassword(e.target.value)}
          trailing={
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Hide password' : 'Show password'}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-faint hover:bg-sunken hover:text-ink"
            >
              {show ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          }
        />
        <Button type="submit" size="lg" full loading={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
        <p className="text-center">
          <a href="#reset" className="font-body text-sm text-ink-muted hover:text-ink">
            Forgot your password?
          </a>
        </p>
      </form>
    </AuthShell>
  );
}
