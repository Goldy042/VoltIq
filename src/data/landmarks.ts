/**
 * Landmarks people in Nsukka actually give directions by. Most streets here
 * have no public name, so "opposite Ogige Market" beats any street address.
 *
 * `osm` entries are positioned from OpenStreetMap. `local` entries are
 * well-known places placed by hand — confirm on the ground, and let residents
 * add more (Phase 5: community landmarks).
 */

export type LandmarkKind =
  | 'gate'
  | 'junction'
  | 'market'
  | 'campus'
  | 'hostel'
  | 'church'
  | 'hospital'
  | 'bank'
  | 'school'
  | 'park'
  | 'other';

export interface Landmark {
  id: string;
  name: string;
  kind: LandmarkKind;
  lat: number;
  lng: number;
  source: 'osm' | 'local';
  /** Other names people use, for search. */
  aka?: string[];
}

export const landmarks: Landmark[] = [
  // ---- From OpenStreetMap ----
  { id: 'ogige-market', name: 'Ogige Market', kind: 'market', lat: 6.85097, lng: 7.39942, source: 'osm', aka: ['ogige'] },
  { id: 'unn', name: 'University of Nigeria (UNN)', kind: 'campus', lat: 6.86509, lng: 7.40842, source: 'osm', aka: ['unn', 'university', 'campus'] },
  { id: 'unn-medical', name: 'UNN Medical Centre', kind: 'hospital', lat: 6.86044, lng: 7.41315, source: 'osm', aka: ['medical center', 'clinic'] },
  { id: 'nnamdi-library', name: 'Nnamdi Azikiwe Library', kind: 'campus', lat: 6.86413, lng: 7.40844, source: 'osm', aka: ['library'] },
  { id: 'vc-building', name: 'VC Building, UNN', kind: 'campus', lat: 6.86278, lng: 7.40808, source: 'osm', aka: ['vice chancellor'] },
  { id: 'unn-post-office', name: 'UNN Post Office', kind: 'other', lat: 6.86033, lng: 7.40729, source: 'osm', aka: ['post office'] },
  { id: 'first-bank-unn', name: 'First Bank, UNN branch', kind: 'bank', lat: 6.86498, lng: 7.40743, source: 'osm', aka: ['first bank', 'bank'] },
  { id: 'akanu-ibiam-stadium', name: 'Akanu Ibiam Stadium', kind: 'park', lat: 6.86644, lng: 7.40421, source: 'osm', aka: ['stadium'] },
  { id: 'univ-primary', name: 'University Primary School', kind: 'school', lat: 6.86053, lng: 7.40515, source: 'osm', aka: ['primary school'] },
  { id: 'st-peter-chaplaincy', name: 'St Peter’s Chaplaincy', kind: 'church', lat: 6.85874, lng: 7.41054, source: 'osm', aka: ['chaplaincy', 'saint peter'] },
  { id: 'st-matthews', name: 'St Matthew’s Anglican Church', kind: 'church', lat: 6.87714, lng: 7.4154, source: 'osm', aka: ['anglican'] },
  { id: 'zik-flat', name: 'Zik Flat', kind: 'hostel', lat: 6.87173, lng: 7.39826, source: 'osm', aka: ['zik'] },
  { id: 'civil-eng', name: 'Civil Engineering, UNN', kind: 'campus', lat: 6.86699, lng: 7.4095, source: 'osm', aka: ['engineering'] },
  { id: 'jesus-house', name: 'Jesus House Prevailing Word', kind: 'church', lat: 6.86321, lng: 7.38737, source: 'osm' },
  { id: 'lords-chosen', name: 'The Lord’s Chosen Church', kind: 'church', lat: 6.86379, lng: 7.3886, source: 'osm' },
  { id: 'father-agbo', name: 'Father Agbo Bar', kind: 'other', lat: 6.87937, lng: 7.41942, source: 'osm' },
  { id: 'chitis', name: 'Chitis Restaurant', kind: 'other', lat: 6.86547, lng: 7.4105, source: 'osm' },

  // ---- Well-known local landmarks (placed by hand) ----
  { id: 'unn-main-gate', name: 'UNN Main Gate', kind: 'junction', lat: 6.8589, lng: 7.4045, source: 'local', aka: ['main gate', 'unn gate'] },
  { id: 'odim-gate', name: 'Odim Gate', kind: 'gate', lat: 6.8716, lng: 7.4142, source: 'local', aka: ['odim', 'vet odim'] },
  { id: 'beach-junction', name: 'Beach Junction', kind: 'junction', lat: 6.8553, lng: 7.4052, source: 'local', aka: ['beach'] },
  { id: 'hilltop-gate', name: 'Hilltop Gate', kind: 'gate', lat: 6.857663, lng: 7.411243, source: 'local', aka: ['hilltop', 'hill top', 'hill top gate'] },
  { id: 'odenigwe', name: 'Odenigwe', kind: 'junction', lat: 6.8577, lng: 7.4028, source: 'local' },
  { id: 'ogige-park', name: 'Ogige Motor Park', kind: 'park', lat: 6.85, lng: 7.3985, source: 'local', aka: ['motor park', 'park', 'town'] },
  { id: 'post-office-road', name: 'Post Office Road', kind: 'junction', lat: 6.8563, lng: 7.3931, source: 'local', aka: ['town', 'post office'] },
  { id: 'enugu-road-opi', name: 'Enugu Road, Opi side', kind: 'junction', lat: 6.8314, lng: 7.4066, source: 'local', aka: ['enugu road', 'opi'] },
  { id: 'onuiyi', name: 'Onuiyi', kind: 'junction', lat: 6.8508, lng: 7.4128, source: 'local' },
  { id: 'nru-square', name: 'Nru village square', kind: 'other', lat: 6.864, lng: 7.385, source: 'local', aka: ['nru'] },
  { id: 'obukpa-road', name: 'Obukpa Road', kind: 'junction', lat: 6.9, lng: 7.415, source: 'local', aka: ['obukpa'] },
];
