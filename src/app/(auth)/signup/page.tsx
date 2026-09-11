"use client";
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LocateFixedIcon } from 'lucide-react';
import { AuthShell } from '../components/auth/AuthShell';
import { TextField } from '../components/ui/TextField';
import { Button } from '../components/ui/Button';

export function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [locating, setLocating] = useState(false);
  const [located, setLocated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const useCurrentLocation = () => {
    setLocating(true);
    window.setTimeout(() => {
      setAddress('48 Alder Street, Northfield');
      setLocating(false);
      setLocated(true);
    }, 700);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@') || password.length < 6 || address.trim().length < 4) {
      setError('We need an email, a password of 6+ characters, and the address to watch.');
      return;
    }
    setError(null);
    setPending(true);
    window.setTimeout(() => navigate('/dashboard'), 500);
  };

  return (
    <AuthShell
      eyebrow="Create an account"
      title="Tell us which street to watch."
      intro="Your address decides which feeder we monitor for you, and where your reports land on the map. It is never shown publicly — the map only ever shows a block."
      footer={
      <p>
          Already have an account?{' '}
          <Link
          to="/login"
          className="border-b border-ink text-ink transition-colors duration-150 ease-out hover:border-accent hover:text-accent">
          
            Sign in
          </Link>
          .
        </p>
      }>
      
      <form onSubmit={submit} noValidate className="space-y-8">
        {error &&
        <p
          role="alert"
          className="border-l-2 py-2 pl-4 font-body text-sm"
          style={{
            borderColor: 'var(--status-critical)',
            color: 'var(--status-critical)'
          }}>
          
            {error}
          </p>
        }

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)} />
        

        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)} />
        

        <TextField
          label="Address to watch"
          autoComplete="street-address"
          placeholder="Street and number"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setLocated(false);
          }}
          hint={
          located ?
          'Set from your current location — edit it if the pin is off.' :
          'Used to match you to a feeder and to pre-fill outage reports.'
          }
          trailing={
          <button
            type="button"
            onClick={useCurrentLocation}
            className="flex items-center gap-1.5 font-body text-2xs uppercase tracking-wide text-accent transition-colors duration-150 ease-out hover:text-ink">
            
              <LocateFixedIcon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              {locating ? 'Locating…' : 'Use current'}
            </button>
          } />
        

        <Button type="submit" size="lg" disabled={pending} full className="sm:w-auto sm:min-w-[13rem]">
          {pending ? 'Creating account…' : 'Create account'}
        </Button>

        <p className="font-body text-xs leading-body text-ink-faint">
          By creating an account you agree to receive outage and prediction
          alerts for your feeder. You can turn predictions off at any time.
        </p>
      </form>
    </AuthShell>);

}