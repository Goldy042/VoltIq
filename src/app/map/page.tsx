import { MapScreen } from '@/components/screens/MapScreen';

export const metadata = { title: 'Live map · VoltIq Nsukka' };

export default async function MapPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const { focus } = await searchParams;
  return <MapScreen view="citizen" initialFocus={focus} />;
}
