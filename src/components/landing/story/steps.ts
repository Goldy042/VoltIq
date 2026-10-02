/**
 * The landing page story: one night in Nsukka, told on a fixed map.
 * Each step sets the clock, the copy, the camera and what the map shows.
 */

export type LightState = 'on' | 'off' | 'low';

export interface StoryCamera {
  lng: number;
  lat: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface StoryStep {
  id: string;
  clock: string;
  eyebrow?: string;
  title: string;
  body?: string;
  camera: StoryCamera;
  lights: { odenigwe: LightState; hilltop: LightState; odim: LightState };
  /** Odenigwe report dots (red) visible. */
  reports: boolean;
  /** Hilltop low-voltage report dots (orange) visible. */
  lowReports: boolean;
  crew: 'hidden' | 'driving' | 'arrived';
  restored: boolean;
  forecast: boolean;
}

const ODENIGWE = { lng: 7.4028, lat: 6.8577 };
const HILLTOP = { lng: 7.4168, lat: 6.8551 };
const ODIM = { lng: 7.415, lat: 6.8703 };

export const steps: StoryStep[] = [
  {
    id: 'hero',
    clock: '9:40 PM',
    title: 'Know before the light goes.',
    camera: { lng: 7.4005, lat: 6.859, zoom: 13.4, pitch: 35, bearing: -12 },
    lights: { odenigwe: 'on', hilltop: 'on', odim: 'on' },
    reports: false, lowReports: false, crew: 'hidden', restored: false, forecast: false,
  },
  {
    id: 'tonight',
    clock: '9:40 PM',
    eyebrow: 'Nsukka, tonight',
    title: 'Every light here is a real home.',
    body: 'All 32,697 buildings mapped in Nsukka, from Ogige Market to Odim Gate. Tonight we follow one outage from the first report to the fix.',
    camera: { lng: 7.404, lat: 6.86, zoom: 14, pitch: 52, bearing: 18 },
    lights: { odenigwe: 'on', hilltop: 'on', odim: 'on' },
    reports: false, lowReports: false, crew: 'hidden', restored: false, forecast: false,
  },
  {
    id: 'dark',
    clock: '9:47 PM',
    eyebrow: 'Odenigwe',
    title: 'Odenigwe goes dark.',
    body: 'A loud bang from the transformer near the UNN main gate. About 610 homes lose light at once.',
    camera: { ...ODENIGWE, zoom: 15.4, pitch: 56, bearing: -22 },
    lights: { odenigwe: 'off', hilltop: 'on', odim: 'on' },
    reports: false, lowReports: false, crew: 'hidden', restored: false, forecast: false,
  },
  {
    id: 'reports',
    clock: '9:49 PM',
    eyebrow: 'It’s not just you',
    title: 'Chiamaka reports it. So do 46 neighbours.',
    body: 'One tap each. Every report lands on the same map, so nobody sits in the dark wondering if it’s only their house.',
    camera: { ...ODENIGWE, zoom: 15.9, pitch: 60, bearing: 8 },
    lights: { odenigwe: 'off', hilltop: 'on', odim: 'on' },
    reports: true, lowReports: false, crew: 'hidden', restored: false, forecast: false,
  },
  {
    id: 'low',
    clock: '9:55 PM',
    eyebrow: 'Hilltop',
    title: 'Some streets don’t go dark. They go weak.',
    body: 'Dim bulbs, slow fans, a fridge that won’t start. People log low voltage too, with the reading from their stabiliser: 142 V tonight, against the normal 230 V.',
    camera: { ...HILLTOP, zoom: 15.3, pitch: 55, bearing: 32 },
    lights: { odenigwe: 'off', hilltop: 'low', odim: 'on' },
    reports: true, lowReports: true, crew: 'hidden', restored: false, forecast: false,
  },
  {
    id: 'crew',
    clock: '10:02 PM',
    eyebrow: 'EEDC Nsukka',
    title: 'EEDC sees exactly where. A crew is already moving.',
    body: 'Crew Bravo leaves the Enugu Road injection substation for the 3 km drive to Odenigwe. Residents can follow the truck on the map.',
    camera: { lng: 7.3975, lat: 6.8525, zoom: 14.7, pitch: 45, bearing: -6 },
    lights: { odenigwe: 'off', hilltop: 'low', odim: 'on' },
    reports: true, lowReports: true, crew: 'driving', restored: false, forecast: false,
  },
  {
    id: 'restored',
    clock: '10:31 PM',
    eyebrow: 'Odenigwe',
    title: 'Light restored.',
    body: 'Everyone who reported gets a message the moment supply comes back. No calls and no guessing.',
    camera: { ...ODENIGWE, zoom: 15.3, pitch: 55, bearing: -38 },
    lights: { odenigwe: 'on', hilltop: 'low', odim: 'on' },
    reports: false, lowReports: true, crew: 'arrived', restored: true, forecast: false,
  },
  {
    id: 'forecast',
    clock: 'Tomorrow, 4:00 PM',
    eyebrow: 'AI forecast · 78% likely',
    title: 'Next time, you hear first.',
    body: 'The UNN Campus feeder has overloaded three evenings in a row and rain is coming. Odim Gate is warned three hours early, with time to charge phones and pump water.',
    camera: { ...ODIM, zoom: 14.8, pitch: 50, bearing: 22 },
    lights: { odenigwe: 'on', hilltop: 'on', odim: 'on' },
    reports: false, lowReports: false, crew: 'hidden', restored: false, forecast: true,
  },
  {
    id: 'outro',
    clock: 'Tomorrow, 4:00 PM',
    title: '',
    camera: { lng: 7.402, lat: 6.859, zoom: 13.1, pitch: 0, bearing: 0 },
    lights: { odenigwe: 'on', hilltop: 'on', odim: 'on' },
    reports: false, lowReports: false, crew: 'hidden', restored: false, forecast: true,
  },
];

/** Real driving route (OSRM over OpenStreetMap): Enugu Rd substation → Odenigwe. */
export const crewRoute: [number, number][] = [
  [7.40051, 6.84645], [7.40063, 6.84681], [7.40067, 6.84689], [7.40088, 6.84714], [7.40096, 6.84705],
  [7.40104, 6.84709], [7.40093, 6.8472], [7.40067, 6.84746], [7.39985, 6.84821], [7.39949, 6.84843],
  [7.39909, 6.84865], [7.39827, 6.84908], [7.39815, 6.84915], [7.39798, 6.84924], [7.39788, 6.84929],
  [7.3977, 6.84939], [7.39676, 6.84989], [7.39617, 6.85023], [7.39601, 6.85033], [7.39552, 6.85072],
  [7.39534, 6.85088], [7.39482, 6.8513], [7.39436, 6.85168], [7.39433, 6.8517], [7.39346, 6.85257],
  [7.39282, 6.85328], [7.39243, 6.85372], [7.39233, 6.85387], [7.39221, 6.85404], [7.39223, 6.85406],
  [7.39249, 6.85407], [7.3926, 6.85408], [7.39285, 6.85406], [7.39307, 6.85405], [7.39322, 6.85407],
  [7.39332, 6.8541], [7.39339, 6.85412], [7.39356, 6.85419], [7.39376, 6.85432], [7.39404, 6.85454],
  [7.39446, 6.85495], [7.39495, 6.85547], [7.39527, 6.85581], [7.39604, 6.85675], [7.39649, 6.85746],
  [7.39685, 6.85819], [7.39733, 6.85903], [7.39788, 6.85909], [7.39804, 6.85906], [7.39892, 6.85915],
  [7.39903, 6.85915], [7.39988, 6.85926], [7.4002, 6.8593], [7.40049, 6.8593], [7.40078, 6.85922],
  [7.40186, 6.85896], [7.40169, 6.85763], [7.40305, 6.85747],
];

/** Story areas whose lights change; everything else stays lit. */
export const storyAreas = {
  odenigwe: { ...ODENIGWE, radius: 430 },
  hilltop: { ...HILLTOP, radius: 300 },
  odim: { ...ODIM, radius: 560 },
} as const;
