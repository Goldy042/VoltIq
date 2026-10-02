import { redirect } from 'next/navigation';
import { OperatorOverview } from '@/components/operator/OperatorOverview';

export const metadata = { title: 'EEDC operations · VoltIq' };

export default async function OperatorPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  // Old links (/operator?focus=…) pointed at the map.
  const { focus } = await searchParams;
  if (focus) redirect(`/operator/map?focus=${encodeURIComponent(focus)}`);
  return <OperatorOverview />;
}
