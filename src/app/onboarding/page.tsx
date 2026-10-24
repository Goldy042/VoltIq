import { requireOnboarding } from '@/server/guards';
import { OnboardingScreen } from '@/components/screens/OnboardingScreen';

export const metadata = { title: 'Set up · VoltIq' };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ again?: string }> }) {
  const { again } = await searchParams;
  await requireOnboarding(again === '1');
  return <OnboardingScreen />;
}
