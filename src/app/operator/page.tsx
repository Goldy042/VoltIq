import { MapScreen } from '@/components/screens/MapScreen';

export const metadata = { title: 'EEDC dispatch · VoltIq' };

export default async function OperatorPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const { focus } = await searchParams;
  return <MapScreen view="operator" initialFocus={focus} />;
}
