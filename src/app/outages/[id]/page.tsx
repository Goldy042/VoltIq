import { notFound } from 'next/navigation';
import { OutageScreen } from '@/components/screens/OutageScreen';
import { getDb } from '@/lib/db/client';
import { issueMeta } from '@/data/nsukka';
import { getOutageDetail } from '@/server/incidents';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const detail = await getOutageDetail(getDb(), (await params).id).catch(() => null);
  if (!detail) return { title: 'Outage · VoltIq' };
  return {
    title: `${issueMeta[detail.incident.issue].label} · ${detail.incident.area} · VoltIq`,
    description: `${detail.incident.reports} residents reported ${issueMeta[detail.incident.issue].label.toLowerCase()} at ${detail.incident.place}. Follow the repair live.`,
  };
}

/** Public page for one outage — shareable, linked from the map, alerts and "Your reports". */
export default async function OutagePage({ params }: Props) {
  const detail = await getOutageDetail(getDb(), (await params).id);
  if (!detail) notFound();
  return <OutageScreen initial={detail} />;
}
