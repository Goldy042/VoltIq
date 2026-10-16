import { getDb } from '@/lib/db/client';
import { applyOrgAction, loadOrg, type OrgAction } from '@/server/operations';
import { readJson, withUser } from '@/server/http';

/** Staff and teams for the operator dashboard. */
export const GET = withUser(async (user) => Response.json(await loadOrg(getDb(), user)), { staff: true });

/** One roster change (assign lead, set role, move, shift, create/rename team); returns the fresh roster. */
export const POST = withUser(
  async (user, req) => {
    const db = getDb();
    await applyOrgAction(db, user, await readJson<OrgAction>(req));
    return Response.json(await loadOrg(db, user));
  },
  { staff: true },
);
