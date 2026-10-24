import { after } from 'next/server';
import { getDb } from '@/lib/db/client';
import { submitReport } from '@/server/reports';
import { askNeighbours } from '@/server/checks';
import { ipHash, readJson, withUser } from '@/server/http';
import type { ReportInput } from '@/lib/reporting';

/** Submit a report. Merges into your open report for the same outage when there is one. */
export const POST = withUser(async (user, req) => {
  const result = await submitReport(getDb(), user.id, await readJson<ReportInput>(req), { ipHash: ipHash(req) });
  // A new report can grow an outage: ask the neighbours around it whether they have light.
  const incidentId = result.outcome === 'created' ? result.incident?.id : undefined;
  if (incidentId) after(() => askNeighbours(getDb(), incidentId));
  return Response.json(result, { status: result.outcome === 'created' ? 201 : 200 });
});
