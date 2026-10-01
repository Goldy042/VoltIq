import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, Schibsted_Grotesk } from 'next/font/google';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

// Self-hosted through next/font so there is no render-blocking request to
// fonts.googleapis.com and no layout shift. globals.css maps these onto
// --font-display/--font-body.
const schibsted = Schibsted_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-schibsted',
  display: 'swap',
});

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex',
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${schibsted.variable} ${plex.variable}`}
    >
      {/* Browser extensions (e.g. Grammarly) add attributes to <html>/<body> before hydration. */}
      <body suppressHydrationWarning className="min-h-full w-full bg-canvas font-body text-ink">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
