import 'server-only';

import { createHash } from 'node:crypto';
import { getCurrentUser, isStaff, type DbUser } from './users';
import { ReportError } from './reports';
import type { ApiError } from '@/lib/reporting';

const status: Record<string, number> = {
  invalid: 400,
  outside_area: 422,
  rate_limited: 429,
  not_found: 404,
  forbidden: 403,
  unauthenticated: 401,
};

export function errorResponse(code: ApiError['error']['code'], message: string, extra: { retryAfterSec?: number; field?: string } = {}) {
  const body: ApiError = { error: { code, message, ...extra } };
  const headers: Record<string, string> = {};
  if (extra.retryAfterSec) headers['Retry-After'] = String(extra.retryAfterSec);
  return Response.json(body, { status: status[code] ?? 500, headers });
}

type Handler<C> = (user: DbUser, req: Request, ctx: C) => Promise<Response>;

/** Route handler wrapper: signed-in user (401 otherwise), typed errors → JSON. */
export function withUser<C = unknown>(handler: Handler<C>, opts: { staff?: boolean } = {}) {
  return async (req: Request, ctx: C) => {
    try {
      const user = await getCurrentUser();
      if (!user) return errorResponse('unauthenticated', 'Sign in to continue.');
      if (opts.staff && !isStaff(user)) return errorResponse('forbidden', 'Only EEDC staff can do this.');
      return await handler(user, req, ctx);
    } catch (e) {
      if (e instanceof ReportError) return errorResponse(e.code, e.message, e.extra);
      if (e instanceof SyntaxError) return errorResponse('invalid', 'Malformed request.');
      console.error(e);
      return errorResponse('server_error', 'Something went wrong. Try again.');
    }
  };
}

export async function readJson<T>(req: Request): Promise<T> {
  return (await req.json()) as T;
}

/**
 * Salted hash of the caller's IP, only for per-network rate limits. The raw
 * address is never stored.
 */
export function ipHash(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '';
  if (!ip) return null;
  const salt = process.env.VOLTIQ_IP_SALT ?? 'voltiq-dev-salt';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}
