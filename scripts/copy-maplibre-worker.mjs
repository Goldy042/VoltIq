// MapLibre 6 locates its tile-decoding worker relative to its own module URL,
// which Turbopack rewrites — so the worker 404s and no tiles render. Serve the
// worker (and the shared chunk it imports) from /public instead; the map
// components point MapLibre at it with setWorkerUrl().
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dist = join(dirname(require.resolve('maplibre-gl/package.json')), 'dist');
const out = join(process.cwd(), 'public', 'maplibre');

mkdirSync(out, { recursive: true });
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(join(dist, file), join(out, file));
}
console.log('maplibre worker copied to public/maplibre');
