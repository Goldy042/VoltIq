import { redirect } from 'next/navigation';
import { getCurrentUser, homeFor } from '@/server/users';

/** Login and sign-up land here; we send each person to the right screen. */
export async function GET() {
  const user = await getCurrentUser();
  redirect(user ? homeFor(user) : '/login');
}
