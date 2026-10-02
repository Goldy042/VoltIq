import { requireOnboarding } from '@/server/guards';
import { OnboardingScreen } from '@/components/screens/OnboardingScreen';

export const metadata = { title: 'Set up · VoltIq' };

export default async function OnboardingPage() {
  await requireOnboarding();
  return <OnboardingScreen />;
}
