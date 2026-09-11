// app/page.tsx
import { Landing } from '@/components/Landing';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ audience?: string }>;
}) {
  const params = await searchParams;
  const audience = params.audience === 'utilities' ? 'utilities' : 'citizens';
  return <Landing audience={audience} />;
}