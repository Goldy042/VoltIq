import { redirectIfSignedIn } from '@/server/guards';
import { LoginScreen } from '@/components/screens/LoginScreen';

export const metadata = { title: 'Sign in · VoltIq' };

export default async function LoginPage() {
  await redirectIfSignedIn();
  return <LoginScreen />;
}
