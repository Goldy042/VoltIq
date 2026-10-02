import { getDb } from '@/lib/db/client';
import { listLightBackPrompts } from '@/server/reports';
import { withUser } from '@/server/http';

/** Your open reports we should ask "is your light back?" about. */
export const GET = withUser(async (user) => Response.json({ reports: await listLightBackPrompts(getDb(), user.id) }));
