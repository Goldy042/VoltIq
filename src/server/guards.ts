import 'server-only';

import { redirect } from 'next/navigation';
import { canUseOperator, getCurrentUser } from './users';

/** Resident screens: signed in and onboarded (at least one saved place). */
export async function requireResident() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.onboardedAt && !canUseOperator(user)) redirect('/onboarding');
  return user;
}

/** Onboarding: signed in; already-onboarded residents go home. */
export async function requireOnboarding() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (canUseOperator(user)) redirect('/operator');
  if (user.onboardedAt) redirect('/dashboard');
  return user;
}

/** Operator dashboard: managers, dispatchers and team leads. */
export async function requireOperator() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canUseOperator(user)) redirect('/dashboard');
  return user;
}

/** Login / sign-up pages: already signed in → straight to the right screen. */
export async function redirectIfSignedIn() {
  const user = await getCurrentUser();
  if (user) redirect('/auth/continue');
}
