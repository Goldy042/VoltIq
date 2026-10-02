/** Profile shapes shared by the resident app and the API. */

import type { AreaCorrection } from './address';

export type PlaceLabel = 'home' | 'hostel' | 'shop' | 'work' | 'other';

export const placeLabels: Record<PlaceLabel, string> = {
  home: 'Home',
  hostel: 'Hostel',
  shop: 'Shop',
  work: 'Work',
  other: 'Other',
};

export interface SavedPlace {
  id: string;
  label: PlaceLabel;
  /** Only used when label is "other". */
  customName?: string;
  lat: number;
  lng: number;
  areaId: string;
  /** How a neighbour would describe it: "Yellow gate opposite the chemist". */
  directions: string;
  plusCode: string;
  /** GPS error in metres when the pin came from the phone (sent to the API, not shown). */
  accuracy?: number;
  /** Prepaid meter number — later used to match the exact feeder. */
  meterNumber?: string;
}

export interface AlertPrefs {
  email: boolean;
  /** Costs us per message, so off unless the person turns it on. */
  sms: boolean;
  push: boolean;
  whatsapp: boolean;
  forecasts: boolean;
  repairs: boolean;
  restored: boolean;
  quietHours: boolean;
}

export interface Profile {
  name: string;
  phone: string;
  email: string;
  onboarded: boolean;
  places: SavedPlace[];
  primaryPlaceId: string | null;
  alerts: AlertPrefs;
  /** Places where this person told us the area we guessed was wrong. */
  areaCorrections: AreaCorrection[];
}

export const defaultAlerts: AlertPrefs = {
  email: true,
  sms: false,
  push: true,
  whatsapp: false,
  forecasts: true,
  repairs: true,
  restored: true,
  quietHours: true,
};
