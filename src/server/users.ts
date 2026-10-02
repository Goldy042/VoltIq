import 'server-only';

import { auth, currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema';

export type DbUser = typeof users.$inferSelect;

export const STAFF_ROLES = ['manager', 'dispatcher', 'team_lead', 'technician'] as const;
export const isStaff = (u: Pick<DbUser, 'role'>) => (STAFF_ROLES as readonly string[]).includes(u.role);

/** Comma-separated emails that become managers on first sign-in (bootstraps the first manager). */
const managerEmails = () =>
  (process.env.VOLTIQ_MANAGER_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/**
 * The signed-in person's row, created on their first request. Clerk owns
 * sign-in; we own everything else. A row a manager created in advance for
 * the same email (staff) is linked instead of duplicated.
 */
export async function getCurrentUser(): Promise<DbUser | null> {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return null;
  const db = getDb();

  const [existing] = await db.select().from(users).where(eq(users.clerkUserId, userId));
  if (existing) return existing;

  const clerk = await currentUser();
  if (!clerk) return null;
  const email = (clerk.primaryEmailAddress?.emailAddress ?? clerk.emailAddresses[0]?.emailAddress ?? '').toLowerCase();
  if (!email) return null;
  const name = clerk.fullName?.trim() || [clerk.firstName, clerk.lastName].filter(Boolean).join(' ') || email.split('@')[0];
  const phone = typeof clerk.unsafeMetadata?.phone === 'string' ? clerk.unsafeMetadata.phone.slice(0, 20) : null;

  const [byEmail] = await db.select().from(users).where(eq(users.email, email));
  if (byEmail) {
    if (byEmail.clerkUserId && byEmail.clerkUserId !== userId) return null; // email reused by a different Clerk account
    const [linked] = await db.update(users).set({ clerkUserId: userId, updatedAt: new Date() }).where(eq(users.id, byEmail.id)).returning();
    return linked;
  }

  const [created] = await db
    .insert(users)
    .values({ clerkUserId: userId, email, name, phone, role: managerEmails().includes(email) ? 'manager' : 'citizen' })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  // Two first requests raced; the other one created the row.
  const [raced] = await db.select().from(users).where(eq(users.clerkUserId, userId));
  return raced ?? null;
}

/** Where someone belongs right after signing in. */
export function homeFor(u: DbUser) {
  if (canUseOperator(u)) return '/operator';
  // Residents, and technicians until they have a field app, use the resident app.
  return u.onboardedAt ? '/dashboard' : '/onboarding';
}

/** Managers, dispatchers and team leads see the operator dashboard (see roleMeta). */
export const canUseOperator = (u: Pick<DbUser, 'role'>) => u.role === 'manager' || u.role === 'dispatcher' || u.role === 'team_lead';
