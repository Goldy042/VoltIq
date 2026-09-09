import type { Metadata } from 'next';
import { IBM_Plex_Sans, Schibsted_Grotesk } from 'next/font/google';
import './globals.css';

// Self-hosted through next/font so there is no render-blocking request to
// fonts.googleapis.com and no layout shift. Weights match the original
// vite-ui @import exactly; globals.css maps these onto --font-display/--font-body.
const schibsted = Schibsted_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-schibsted',
  display: 'swap',
});

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-plex',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VoltIq — community outage reporting and prediction',
  description:
    'Residents report power outages, the distribution company dispatches crews from a shared live map, and forecast alerts warn neighbourhoods before the power goes out.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${schibsted.variable} ${plex.variable}`}
    >
      <body className="min-h-full w-full bg-canvas font-body text-ink">
        {children}
      </body>
    </html>
  );
}
