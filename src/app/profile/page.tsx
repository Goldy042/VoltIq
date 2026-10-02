import { requireResident } from '@/server/guards';
import { ProfileScreen } from '@/components/screens/ProfileScreen';

export const metadata = { title: 'Profile · VoltIq' };

export default async function ProfilePage() {
  await requireResident();
  return <ProfileScreen />;
}
