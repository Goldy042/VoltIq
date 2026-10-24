import { requireResident } from '@/server/guards';
import { ReportsScreen } from '@/components/screens/ReportsScreen';

export const metadata = { title: 'Your reports · VoltIq' };

export default async function ReportsPage() {
  await requireResident();
  return <ReportsScreen />;
}
