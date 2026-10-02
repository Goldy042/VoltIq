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
