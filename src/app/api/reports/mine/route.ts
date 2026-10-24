import { getDb } from '@/lib/db/client';
import { listMyReports } from '@/server/reports';
import { withUser } from '@/server/http';

/** The signed-in resident's reports, newest first. */
export const GET = withUser(async (user) =>
  Response.json({ reports: await listMyReports(getDb(), user.id) }, { headers: { 'Cache-Control': 'no-store' } }),
);
