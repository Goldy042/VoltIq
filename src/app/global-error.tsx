'use client';

/**
 * Last resort when the root layout itself fails: no providers, fonts or
 * styles are guaranteed here, so it's plain inline-styled HTML.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#f3f3f0', color: '#111113', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <p style={{ fontFamily: 'monospace', fontSize: 13, color: '#8a8a90' }}>{error.digest ? `Error ${error.digest}` : 'Error'}</p>
          <h1 style={{ fontSize: 28, margin: '12px 0' }}>VoltIq couldn’t load</h1>
          <p style={{ color: '#55555c', lineHeight: 1.5 }}>Check your data connection, then try again.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 24, height: 48, padding: '0 24px', borderRadius: 999, border: 0, background: '#111113', color: '#fff', fontSize: 16, fontWeight: 600 }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
