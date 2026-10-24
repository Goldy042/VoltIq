'use client';

import React, { useState } from 'react';
import { useClerk } from '@clerk/nextjs';
import { LogOutIcon } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { withAuthTimeout } from './clerk';

/**
 * Ends the Clerk session, then does a full page load of the landing page so
 * no signed-in data stays in memory.
 */
export function SignOutButton({
  className,
  iconClassName = 'h-5 w-5',
  label = 'Sign out',
  iconOnly = false,
}: {
  className?: string;
  iconClassName?: string;
  label?: string;
  iconOnly?: boolean;
}) {
  const { signOut } = useClerk();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const run = async () => {
    setPending(true);
    try {
      await withAuthTimeout(signOut({ redirectUrl: '/' }));
      // signOut navigates; this covers browsers where it doesn't.
      window.location.assign('/');
    } catch {
      setPending(false);
      toast({ title: 'Couldn’t sign out', body: 'Check your connection and try again.', color: 'var(--status-out)' });
    }
  };

  return (
    <button type="button" onClick={run} disabled={pending} className={className} aria-label={iconOnly ? label : undefined} title={iconOnly ? label : undefined}>
      <LogOutIcon className={iconClassName} aria-hidden="true" />
      {!iconOnly && (pending ? 'Signing out…' : label)}
    </button>
  );
}
