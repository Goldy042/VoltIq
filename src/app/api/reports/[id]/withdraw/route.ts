import { getDb } from '@/lib/db/client';
import { withdrawReport } from '@/server/reports';
import { withUser } from '@/server/http';

type Ctx = { params: Promise<{ id: string }> };

/** Take back your own open report ("I reported by mistake"). */
export const POST = withUser<Ctx>(async (user, _req, { params }) =>
  Response.json(await withdrawReport(getDb(), user.id, (await params).id)),
);
