/** Building centroids from OpenStreetMap, loaded once and shared by every glow map. */
let cache: Promise<number[]> | null = null;

export function loadBuildings(): Promise<number[]> {
  cache ??= fetch('/data/nsukka-buildings.json')
    .then((r) => r.json() as Promise<number[]>)
    .catch((err) => {
      cache = null;
      throw err;
    });
  return cache;
}

/** Equirectangular distance in metres — plenty accurate at neighbourhood scale. */
export function quickMeters(lng: number, lat: number, lng0: number, lat0: number) {
  const dx = (lng - lng0) * 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const dy = (lat - lat0) * 110_540;
  return Math.sqrt(dx * dx + dy * dy);
}
