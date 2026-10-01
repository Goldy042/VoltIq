/**
 * Open Location Code ("plus code") encoder — a free, open standard that gives
 * any ~3 m square on Earth a short code like "V9W2+6Q Nsukka". It works where
 * streets have no names, and Google Maps understands it, so a crew can
 * navigate straight to a pin. Spec: https://github.com/google/open-location-code
 */

const ALPHABET = '23456789CFGHJMPQRVWX';
const RESOLUTIONS = [20, 1, 0.05, 0.0025, 0.000125];

/** Full 10-digit code, e.g. "6FX5V9W2+6Q". */
export function encodePlusCode(lat: number, lng: number): string {
  let la = Math.min(Math.max(lat, -90), 90 - 1e-10) + 90;
  let lo = ((((lng + 180) % 360) + 360) % 360);
  let code = '';
  for (let i = 0; i < RESOLUTIONS.length; i++) {
    const r = RESOLUTIONS[i];
    // Small epsilon guards against floating-point drift at cell edges.
    const dLa = Math.min(19, Math.floor(la / r + 1e-9));
    const dLo = Math.min(19, Math.floor(lo / r + 1e-9));
    la -= dLa * r;
    lo -= dLo * r;
    code += ALPHABET[dLa] + ALPHABET[dLo];
    if (i === 3) code += '+';
  }
  return code;
}

/**
 * Short code relative to Nsukka, e.g. "V9W2+6Q Nsukka". Dropping the first
 * four digits is valid within ~50 km of the named locality.
 */
export function shortPlusCode(lat: number, lng: number, locality = 'Nsukka'): string {
  return `${encodePlusCode(lat, lng).slice(4)} ${locality}`;
}
