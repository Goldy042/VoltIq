import { setWorkerUrl } from 'maplibre-gl';

// See scripts/copy-maplibre-worker.mjs for why the worker is served from /public.
setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
