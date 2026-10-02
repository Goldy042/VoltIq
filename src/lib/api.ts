import type { ApiError } from './reporting';

/** A failed API call, with the server's code and plain-language message. */
export class ApiFailure extends Error {
  constructor(
    public code: ApiError['error']['code'],
    message: string,
    public retryAfterSec?: number,
    public field?: string,
  ) {
    super(message);
  }
}

/** JSON fetch against our API; throws ApiFailure with the server's message on error. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiFailure('server_error', 'No connection. Check your data and try again.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (data as ApiError | null)?.error;
    throw new ApiFailure(e?.code ?? 'server_error', e?.message ?? 'Something went wrong. Try again.', e?.retryAfterSec, e?.field);
  }
  return data as T;
}

/** "about 12 minutes" / "about 2 hours" */
export function waitText(sec: number) {
  if (sec < 90) return 'a minute';
  const min = Math.round(sec / 60);
  if (min < 90) return `${min} minutes`;
  return `${Math.round(min / 60)} hours`;
}
