'use client';

import { useClerk } from '@clerk/nextjs';

/** Clerk's friendlier error text, falling back to its short message. */
export function clerkMessage(error: { message: string; longMessage?: string } | null | undefined) {
  if (!error) return '';
  return error.longMessage || error.message || 'Something went wrong. Try again.';
}

/**
 * finalize() navigate callback: always go through /auth/continue, which
 * sends staff to the operator dashboard and residents to onboarding or home.
 * A full page load (not router.push) so the root layout re-reads who is
 * signed in and hands the app their real profile.
 */
export function goAfterAuth() {
  return ({ decorateUrl }: { decorateUrl: (url: string) => string }) => {
    window.location.assign(decorateUrl('/auth/continue'));
  };
}

/** How long any one sign-in step may take before we stop waiting and say so. */
export const AUTH_STEP_MS = 25_000;

export class AuthTimeout extends Error {
  constructor() {
    super('This is taking too long. Check your connection and try again.');
  }
}

/**
 * Clerk calls wait for Clerk's script to load and for its servers to answer;
 * on a flaky connection either can stall with no end. This puts an end on it.
 */
export function withAuthTimeout<T>(work: Promise<T>, ms = AUTH_STEP_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new AuthTimeout()), ms);
    work.then(
      (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * Whether Clerk's sign-in script loaded. `failed` when it couldn't be
 * downloaded (usually the connection) — the form should say so instead of
 * offering a button that can't work.
 */
export function useAuthReady() {
  const clerk = useClerk();
  const status = (clerk as { status?: string }).status;
  return {
    ready: status ? status === 'ready' || status === 'degraded' : clerk.loaded,
    failed: status === 'error',
  };
}
