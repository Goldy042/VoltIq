import { notFound } from 'next/navigation';
import { OperatorOutage } from '@/components/operator/OperatorOutage';
import { getDb } from '@/lib/db/client';
import { getOutageDetail } from '@/server/incidents';

export const metadata = { title: 'Outage · EEDC operations · VoltIq' };

/** Staff view of one outage. The operator layout has already checked the role. */
export default async function OperatorOutagePage({ params }: { params: Promise<{ id: string }> }) {
  const detail = await getOutageDetail(getDb(), (await params).id, { staff: true });
  if (!detail) notFound();
  return <OperatorOutage initial={detail} />;
}
