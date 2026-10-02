import { redirectIfSignedIn } from '@/server/guards';
import { SignupScreen } from '@/components/screens/SignupScreen';

export const metadata = { title: 'Create an account · VoltIq' };

export default async function SignupPage() {
  await redirectIfSignedIn();
  return <SignupScreen />;
}
