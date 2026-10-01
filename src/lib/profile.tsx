'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { citizenProfile } from '@/data/nsukka';
import { describeLocation } from '@/lib/address';

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

const demoPlace: SavedPlace = {
  id: 'place-demo-home',
  label: 'home',
  lat: citizenProfile.lat,
  lng: citizenProfile.lng,
  areaId: citizenProfile.areaId,
  directions: 'Odim Street, blue gate after the pharmacy',
  plusCode: describeLocation({ lat: citizenProfile.lat, lng: citizenProfile.lng }).plusCode,
};

/** Demo account shown until someone signs up in this browser. */
const demoProfile: Profile = {
  name: citizenProfile.name,
  phone: citizenProfile.phone,
  email: citizenProfile.email,
  onboarded: true,
  places: [demoPlace],
  primaryPlaceId: demoPlace.id,
  alerts: defaultAlerts,
};

const STORAGE_KEY = 'voltiq.profile.v1';

interface ProfileContextValue {
  profile: Profile;
  /** The place the dashboard and reports default to. */
  primary: SavedPlace;
  update: (patch: Partial<Profile>) => void;
  savePlace: (place: SavedPlace) => void;
  removePlace: (id: string) => void;
  setPrimary: (id: string) => void;
  /** Start a fresh account (sign-up), clearing the demo. */
  startNew: (details: Pick<Profile, 'name' | 'phone' | 'email'>) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

/**
 * Mock profile store persisted to localStorage. Replace `persist`/`load` with
 * server actions once Clerk + Neon are wired (Phase 5) — the API stays the same.
 */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile>(demoProfile);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<Profile>;
        setProfile({ ...demoProfile, ...stored, alerts: { ...defaultAlerts, ...stored.alerts } });
      }
    } catch {
      /* corrupted storage: keep the demo profile */
    }
  }, []);

  const commit = useCallback((next: (p: Profile) => Profile) => {
    setProfile((prev) => {
      const value = next(prev);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch {
        /* storage full or blocked: keep it in memory */
      }
      return value;
    });
  }, []);

  const value = useMemo<ProfileContextValue>(() => {
    const primary = profile.places.find((p) => p.id === profile.primaryPlaceId) ?? profile.places[0] ?? demoPlace;
    return {
      profile,
      primary,
      update: (patch) => commit((p) => ({ ...p, ...patch })),
      savePlace: (place) =>
        commit((p) => {
          const exists = p.places.some((x) => x.id === place.id);
          const places = exists ? p.places.map((x) => (x.id === place.id ? place : x)) : [...p.places, place];
          return { ...p, places, primaryPlaceId: p.primaryPlaceId ?? place.id };
        }),
      removePlace: (id) =>
        commit((p) => {
          const places = p.places.filter((x) => x.id !== id);
          return { ...p, places, primaryPlaceId: p.primaryPlaceId === id ? places[0]?.id ?? null : p.primaryPlaceId };
        }),
      setPrimary: (id) => commit((p) => ({ ...p, primaryPlaceId: id })),
      startNew: (details) =>
        commit(() => ({ ...details, onboarded: false, places: [], primaryPlaceId: null, alerts: defaultAlerts })),
    };
  }, [profile, commit]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider');
  return ctx;
}

export function placeName(p: SavedPlace) {
  return p.label === 'other' && p.customName ? p.customName : placeLabels[p.label];
}
