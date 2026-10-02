'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { citizenProfile } from '@/data/nsukka';
import { describeLocation, setAreaCorrections } from '@/lib/address';
import { defaultAlerts, placeLabels, type Profile, type SavedPlace } from './profile-types';
import { api } from './api';

export { defaultAlerts, placeLabels } from './profile-types';
export type { AlertPrefs, PlaceLabel, Profile, SavedPlace } from './profile-types';

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
  areaCorrections: [],
};

const STORAGE_KEY = 'voltiq.profile.v1';

/** What the server knows about the signed-in person, passed down from the root layout. */
export type ServerProfile = Profile & { role: string; trustScore: number };

interface ProfileContextValue {
  profile: Profile;
  /** True when this is a real signed-in account, false for the demo shown to visitors. */
  signedIn: boolean;
  role: string | null;
  trustScore: number | null;
  /** The place the dashboard and reports default to. */
  primary: SavedPlace;
  /** Updates resolve once the server has saved them, and throw ApiFailure when it refuses. */
  update: (patch: Partial<Pick<Profile, 'name' | 'phone' | 'alerts' | 'onboarded'>>) => Promise<void>;
  savePlace: (place: SavedPlace) => Promise<void>;
  removePlace: (id: string) => Promise<void>;
  setPrimary: (id: string) => Promise<void>;
  /** "I'm in Hilltop, not Odim Gate" — remembered for this spot from now on. */
  correctArea: (p: { lat: number; lng: number; accuracy?: number }, areaId: string, guessedAreaId?: string) => Promise<void>;
  /** Re-read the profile from the server. */
  refresh: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

const isServerId = (id: string) => /^[0-9a-f-]{36}$/.test(id);

/**
 * Signed in: the profile lives in Postgres (src/server/profile.ts), changes are
 * applied optimistically and then saved through the API.
 * Signed out: a demo profile in localStorage, so the public map still works.
 */
export function ProfileProvider({ initial, children }: { initial: ServerProfile | null; children: React.ReactNode }) {
  const signedIn = Boolean(initial);
  const [profile, setProfile] = useState<Profile>(initial ?? demoProfile);
  const [meta, setMeta] = useState({ role: initial?.role ?? null, trustScore: initial?.trustScore ?? null });

  // A new sign-in or sign-out re-renders the layout with a different `initial`.
  useEffect(() => {
    if (initial) {
      setProfile(initial);
      setMeta({ role: initial.role, trustScore: initial.trustScore });
    }
  }, [initial]);

  useEffect(() => {
    if (signedIn) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<Profile>;
        setProfile({ ...demoProfile, ...stored, alerts: { ...defaultAlerts, ...stored.alerts }, areaCorrections: stored.areaCorrections ?? [] });
      }
    } catch {
      /* corrupted storage: keep the demo profile */
    }
  }, [signedIn]);

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    const next = await api<ServerProfile>('/api/me');
    setProfile(next);
    setMeta({ role: next.role, trustScore: next.trustScore });
  }, [signedIn]);

  /** Apply locally first; on the server too when signed in, re-syncing if it fails. */
  const commit = useCallback(
    async (local: (p: Profile) => Profile, remote?: () => Promise<unknown>) => {
      setProfile((prev) => {
        const value = local(prev);
        if (!signedIn) {
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
          } catch {
            /* storage full or blocked: keep it in memory */
          }
        }
        return value;
      });
      if (!signedIn || !remote) return;
      try {
        await remote();
      } catch (e) {
        await refresh().catch(() => {});
        throw e;
      }
    },
    [signedIn, refresh],
  );

  const value = useMemo<ProfileContextValue>(() => {
    // describeLocation is a plain function used everywhere; hand it the corrections before children render.
    setAreaCorrections(profile.areaCorrections ?? []);
    const primary = profile.places.find((p) => p.id === profile.primaryPlaceId) ?? profile.places[0] ?? demoPlace;
    const placeBody = (place: SavedPlace) => ({
      label: place.label,
      customName: place.customName,
      lat: place.lat,
      lng: place.lng,
      accuracy: place.accuracy,
      areaSlug: place.areaId || undefined,
      directions: place.directions,
      meterNumber: place.meterNumber,
    });
    return {
      profile,
      signedIn,
      role: meta.role,
      trustScore: meta.trustScore,
      primary,
      refresh,
      update: (patch) =>
        commit(
          (p) => ({ ...p, ...patch }),
          () => api('/api/me', { method: 'PATCH', body: patch }),
        ),
      savePlace: (place) => {
        const exists = profile.places.some((x) => x.id === place.id);
        return commit(
          (p) => {
            const places = exists ? p.places.map((x) => (x.id === place.id ? place : x)) : [...p.places, place];
            return { ...p, places, primaryPlaceId: p.primaryPlaceId ?? place.id };
          },
          async () => {
            if (exists && isServerId(place.id)) await api(`/api/places/${place.id}`, { method: 'PATCH', body: placeBody(place) });
            else await api('/api/places', { body: placeBody(place) });
            await refresh(); // pick up the server's id, area and plus code
          },
        );
      },
      removePlace: (id) =>
        commit(
          (p) => {
            const places = p.places.filter((x) => x.id !== id);
            return { ...p, places, primaryPlaceId: p.primaryPlaceId === id ? places[0]?.id ?? null : p.primaryPlaceId };
          },
          () => api(`/api/places/${id}`, { method: 'DELETE' }),
        ),
      setPrimary: (id) =>
        commit(
          (p) => ({ ...p, primaryPlaceId: id }),
          () => api(`/api/places/${id}`, { method: 'PATCH', body: { primary: true } }),
        ),
      correctArea: (point, areaId, guessedAreaId) =>
        commit(
          (p) => ({
            ...p,
            // Newest first, and one per ~50 m so repeated taps don't pile up.
            areaCorrections: [
              { lat: point.lat, lng: point.lng, areaId },
              ...(p.areaCorrections ?? []).filter(
                (c) => Math.abs(c.lat - point.lat) > 0.00045 || Math.abs(c.lng - point.lng) > 0.00045,
              ),
            ].slice(0, 50),
          }),
          () => api('/api/corrections', { body: { lat: point.lat, lng: point.lng, accuracy: point.accuracy, areaSlug: areaId, guessedSlug: guessedAreaId } }),
        ),
    };
  }, [profile, signedIn, meta, commit, refresh]);

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
