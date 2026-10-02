import { requireResident } from '@/server/guards';
import { DashboardScreen } from '@/components/screens/DashboardScreen';

export const metadata = { title: 'Home · VoltIq' };

export default async function DashboardPage() {
  await requireResident();
  return <DashboardScreen />;
}
