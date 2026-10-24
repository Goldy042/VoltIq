import { ZapIcon } from 'lucide-react';

/** Shown while a page's server work (sign-in check, profile) runs. */
export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas" role="status" aria-label="Loading">
      <span className="flex h-12 w-12 animate-pulse items-center justify-center rounded-sm bg-ink">
        <ZapIcon className="h-6 w-6 fill-volt text-volt" aria-hidden="true" />
      </span>
    </div>
  );
}
