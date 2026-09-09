import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/auth/AuthShell';
import { TextField } from '../components/ui/TextField';
import { Button } from '../components/ui/Button';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@') || password.length < 6) {
      setError('Check your email and password, then try again.');
      return;
    }
    setError(null);
    setPending(true);
    window.setTimeout(() => navigate('/dashboard'), 500);
  };

  return (
    <AuthShell
      eyebrow="Login"
      title="Welcome back to your street."
      intro="Sign in to see your area status, your past reports, and any predicted outages on your feeder."
      footer={
      <p>
          No account yet?{' '}
          <Link
          to="/signup"
          className="border-b border-ink text-ink transition-colors duration-150 ease-out hover:border-accent hover:text-accent">
          
            Create one
          </Link>{' '}
          — or{' '}
          <Link
          to="/report"
          className="border-b border-line-strong transition-colors duration-150 ease-out hover:border-ink hover:text-ink">
          
            report an outage without signing in
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
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 6 characters." />
        

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Button type="submit" size="lg" disabled={pending} className="sm:min-w-[11rem]">
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
          <a
            href="#reset"
            className="font-body text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink">
            
            Forgot your password?
          </a>
        </div>
      </form>
    </AuthShell>);

}