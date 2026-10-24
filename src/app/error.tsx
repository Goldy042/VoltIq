'use client';

import { useEffect } from 'react';
import { StatusPage } from '@/components/app/StatusPage';
import { Button, ButtonLink } from '@/components/ui/Button';

/** Anything that breaks below the root layout lands here instead of a blank screen. */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      code={error.digest ? `Error ${error.digest}` : 'Error'}
      title="Something went wrong on our side"
      body="Your reports are safe. Try again; if it keeps happening, check your data connection and reload."
      actions={
        <>
          <Button size="lg" onClick={() => retry()}>
            Try again
          </Button>
          <ButtonLink href="/dashboard" size="lg" variant="secondary">
            Go home
          </ButtonLink>
        </>
      }
    />
  );
}
