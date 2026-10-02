import { getDb } from '@/lib/db/client';
import { submitReport } from '@/server/reports';
import { ipHash, readJson, withUser } from '@/server/http';
import type { ReportInput } from '@/lib/reporting';

/** Submit a report. Merges into your open report for the same outage when there is one. */
export const POST = withUser(async (user, req) => {
  const result = await submitReport(getDb(), user.id, await readJson<ReportInput>(req), { ipHash: ipHash(req) });
  return Response.json(result, { status: result.outcome === 'created' ? 201 : 200 });
});
