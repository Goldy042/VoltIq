import { getDb } from '@/lib/db/client';
import { listReportLog } from '@/server/operations';
import { withUser } from '@/server/http';

/** Every individual report for review, newest first. */
export const GET = withUser(async () => Response.json({ rows: await listReportLog(getDb()) }), { staff: true });
