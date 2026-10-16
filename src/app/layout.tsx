import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import localFont from 'next/font/local';
import { ToastProvider } from '@/components/ui/Toast';
import { ProfileProvider } from '@/lib/profile';
import { getDb } from '@/lib/db/client';
import { loadProfile } from '@/server/profile';
import { getCurrentUser } from '@/server/users';
import { OperationsProvider } from '@/lib/operations';
import './globals.css';

// Font files live in ./fonts (latin subsets from Fontsource, SIL Open Font
// License) so builds never depend on downloading from Google — a slow or
// failed fetch there breaks `next build`. globals.css maps these onto
// --font-display / --font-body / --font-mono.
const schibsted = localFont({
  src: './fonts/schibsted-grotesk-latin-wght-normal.woff2',
  weight: '400 900',
  variable: '--font-schibsted',
  display: 'swap',
});

const plex = localFont({
  src: [
    { path: './fonts/ibm-plex-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-sans-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-plex',
  display: 'swap',
});

// Tabular figures for the operator control room: counts, IDs, clocks.
const plexMono = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-mono-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-mono-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VoltIq — Nsukka outage map and alerts',
  description:
    'Nsukka residents report no light, low voltage and fluctuating supply on a shared live map. EEDC crews see where the faults are, and AI forecasts warn neighbourhoods before the power goes.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f3f3f0',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Signed-in people get their real profile on first paint; visitors get the demo.
  const user = await getCurrentUser();
  const initial = user ? await loadProfile(getDb(), user) : null;
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${schibsted.variable} ${plex.variable} ${plexMono.variable}`}
    >
      {/* Browser extensions (e.g. Grammarly) add attributes to <html>/<body> before hydration. */}
      <body suppressHydrationWarning className="min-h-full w-full bg-canvas font-body text-ink">
        <ClerkProvider signInUrl="/login" signUpUrl="/signup">
          <ProfileProvider initial={initial}>
            <OperationsProvider>
              <ToastProvider>{children}</ToastProvider>
            </OperationsProvider>
          </ProfileProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
