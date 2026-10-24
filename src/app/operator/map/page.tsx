import { OperatorBoard } from '@/components/operator/OperatorBoard';

export const metadata = { title: 'Dispatch board · EEDC · VoltIq' };

export default async function OperatorMapPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const { focus } = await searchParams;
  return <OperatorBoard initialFocus={focus} />;
}
