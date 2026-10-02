'use client';

import React, { useId, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BriefcaseIcon,
  BuildingIcon,
  CheckIcon,
  ChurchIcon,
  CopyIcon,
  CrossIcon,
  DoorOpenIcon,
  GraduationCapIcon,
  HomeIcon,
  LandmarkIcon,
  LocateFixedIcon,
  MapPinIcon,
  SearchIcon,
  ShoppingBagIcon,
  StoreIcon,
  XIcon,
} from 'lucide-react';
import { LocationPicker } from '@/components/map';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { cn } from '@/components/ui/cn';
import { NSUKKA_CENTER, bandHours } from '@/data/nsukka';
import type { LandmarkKind } from '@/data/landmarks';
import { describeLocation, resolveArea, searchPlaces, type SearchResult } from '@/lib/address';
import { locateBest, locateErrorText, ROUGH_FIX_METERS } from '@/lib/locate';
import { placeLabels, useProfile, type PlaceLabel, type SavedPlace } from '@/lib/profile';
import { areaById } from '@/data/nsukka';
import { distanceMeters } from '@/lib/geo';
import type { Fix } from '@/lib/locate';

const kindIcon: Record<LandmarkKind, React.ElementType> = {
  gate: DoorOpenIcon,
  junction: MapPinIcon,
  market: ShoppingBagIcon,
  campus: GraduationCapIcon,
  hostel: BuildingIcon,
  church: ChurchIcon,
  hospital: CrossIcon,
  bank: LandmarkIcon,
  school: GraduationCapIcon,
  park: MapPinIcon,
  other: MapPinIcon,
};

const labelIcon: Record<PlaceLabel, React.ElementType> = {
  home: HomeIcon,
  hostel: BuildingIcon,
  shop: StoreIcon,
  work: BriefcaseIcon,
  other: MapPinIcon,
};

interface PlacePickerProps {
  initial?: SavedPlace;
  /** Pre-select a label, e.g. "hostel" when adding a second place. */
  defaultLabel?: PlaceLabel;
  saveText: string;
  onSave: (place: SavedPlace) => void;
  onCancel?: () => void;
}

/**
 * Nsukka-first place picker: landmark search or GPS gets you close, dragging
 * the map puts the pin on the gate, and the app writes the address for you.
 */
export function PlacePicker({ initial, defaultLabel = 'home', saveText, onSave, onCancel }: PlacePickerProps) {
  const id = useId();
  const [pos, setPos] = useState(initial ? { lat: initial.lat, lng: initial.lng } : NSUKKA_CENTER);
  const [touched, setTouched] = useState(Boolean(initial));
  const [recenter, setRecenter] = useState(0);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [gpsNote, setGpsNote] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);
  const [label, setLabel] = useState<PlaceLabel>(initial?.label ?? defaultLabel);
  const [customName, setCustomName] = useState(initial?.customName ?? '');
  const [directions, setDirections] = useState(initial?.directions ?? '');
  const [meter, setMeter] = useState(initial?.meterNumber ?? '');
  const [errors, setErrors] = useState<{ pin?: string; name?: string; meter?: string }>({});
  const [copied, setCopied] = useState(false);

  // Last GPS fix; dropped once the pin is dragged further than its error.
  const [fix, setFix] = useState<Fix | null>(null);
  const gps = fix && distanceMeters(fix, pos) <= Math.max(fix.accuracy, 30) ? fix : null;
  // Area the resident picked when our guess was wrong or unsure.
  const [chosenArea, setChosenArea] = useState<string | null>(null);
  const { correctArea } = useProfile();

  const results = useMemo(() => searchPlaces(query), [query]);
  const place = useMemo(() => describeLocation(pos), [pos]);
  const match = useMemo(() => resolveArea(pos, gps?.accuracy ?? 0), [pos, gps?.accuracy]);
  const areaOptions = [match.area, ...match.alternatives];
  const area = (chosenArea && areaById[chosenArea]) || match.area;

  const jumpTo = (p: { lat: number; lng: number }) => {
    setChosenArea(null);
    setPos(p);
    setTouched(true);
    setRecenter(Date.now());
    setErrors((e) => ({ ...e, pin: undefined }));
  };

  const pick = (r: SearchResult) => {
    setQuery(r.name);
    setOpen(false);
    jumpTo({ lat: r.lat, lng: r.lng });
  };

  const locate = () => {
    setLocating(true);
    setGpsNote({ tone: 'ok', text: 'Finding you… GPS gets sharper over a few seconds.' });
    locateBest({
      onFix: (f) => {
        setFix(f);
        jumpTo({ lat: f.lat, lng: f.lng });
      },
      onDone: (fix) => {
        setLocating(false);
        setFix(fix);
        jumpTo({ lat: fix.lat, lng: fix.lng });
        const acc = Math.round(fix.accuracy);
        const match = resolveArea(fix, fix.accuracy);
        setGpsNote(
          acc > ROUGH_FIX_METERS
            ? { tone: 'warn', text: `Your location is rough (about ±${acc} m) — you could be in ${[match.area, ...match.alternatives].map((a) => a.name).join(' or ')}. Drag the map so the pin sits on your gate.` }
            : { tone: 'ok', text: `Found you, accurate to about ${acc} m. Nudge the pin if needed.` },
        );
      },
      onError: (err) => {
        setLocating(false);
        setGpsNote({ tone: 'warn', text: locateErrorText[err] });
      },
    });
  };

  const save = () => {
    const next: typeof errors = {};
    if (!touched) next.pin = 'Search a landmark, use your location, or drag the map to your place first.';
    if (label === 'other' && !customName.trim()) next.name = 'Give this place a name, e.g. “Mum’s house”.';
    if (meter && meter.replace(/\D/g, '').length < 11) next.meter = 'Meter numbers are usually 11 or 13 digits.';
    setErrors(next);
    if (Object.keys(next).length) return;
    // Teach the area guess for this spot when the resident corrected it.
    if (chosenArea && chosenArea !== match.area.id) {
      correctArea({ ...pos, accuracy: gps?.accuracy }, chosenArea, match.area.id).catch(() => {});
    }
    onSave({
      id: initial?.id ?? `place-${Date.now()}`,
      label,
      customName: label === 'other' ? customName.trim() : undefined,
      lat: pos.lat,
      lng: pos.lng,
      areaId: area.id,
      accuracy: gps ? Math.round(gps.accuracy) : undefined,
      directions: directions.trim(),
      plusCode: place.plusCode,
      meterNumber: meter.replace(/\D/g, '') || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Get close: landmark search or GPS */}
      <div className="relative">
        <label htmlFor={`${id}-q`} className="font-body text-sm font-medium text-ink">
          Search a landmark or area
        </label>
        <div className="relative mt-2">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <input
            id={`${id}-q`}
            role="combobox"
            aria-expanded={open && results.length > 0}
            aria-controls={`${id}-list`}
            aria-describedby={`${id}-qhint`}
            autoComplete="off"
            value={query}
            placeholder="e.g. Odim Gate, Ogige Market, Zik Flat"
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) {
                e.preventDefault();
                pick(results[0]);
              }
            }}
            className="h-12 w-full rounded-md border border-line-strong bg-surface pl-11 pr-10 font-body text-base text-ink placeholder:text-ink-faint transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_4px_var(--accent-tint)] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-faint hover:bg-sunken"
            >
              <XIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <AnimatePresence>
            {open && results.length > 0 && (
              <motion.ul
                id={`${id}-list`}
                role="listbox"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-lg bg-surface py-1 shadow-float"
              >
                {results.map((r) => {
                  const Icon = r.type === 'area' ? MapPinIcon : kindIcon[r.kind];
                  return (
                    <li
                      key={`${r.type}-${r.id}`}
                      role="option"
                      aria-selected={false}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(r)}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-canvas"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas text-ink-muted">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-body text-sm font-semibold text-ink">{r.name}</span>
                        <span className="block truncate font-body text-xs text-ink-muted">{r.detail}</span>
                      </span>
                    </li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
        <p id={`${id}-qhint`} className="mt-2 font-body text-xs text-ink-faint">
          Most streets in Nsukka have no name, so a nearby landmark works best.
        </p>
      </div>

      <div>
        <Button
          variant="secondary"
          full
          loading={locating}
          onClick={locate}
          leading={<LocateFixedIcon className="h-4 w-4" aria-hidden="true" />}
        >
          {locating ? 'Finding you…' : 'Use my current location'}
        </Button>
        <AnimatePresence>
          {gpsNote && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={cn('mt-2 font-body text-xs', gpsNote.tone === 'warn' ? 'text-status-low' : 'text-status-restored')}
              role="status"
            >
              {gpsNote.text}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Get exact: drag the map under the pin */}
      <div>
        <p className="font-body text-sm font-medium text-ink">Put the pin on your gate</p>
        <div
          className={cn(
            'relative mt-2 h-64 overflow-hidden rounded-lg bg-sunken transition-shadow',
            errors.pin && 'shadow-[0_0_0_2px_var(--status-out)]',
          )}
        >
          <LocationPicker
            value={pos}
            recenterKey={recenter}
            onChange={(p) => {
              setPos(p);
              setTouched(true);
              setChosenArea(null);
              setErrors((e) => ({ ...e, pin: undefined }));
            }}
          />
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-surface px-3 py-1 font-body text-xs font-medium text-ink-muted shadow-card">
            Drag the map to move the pin
          </span>
        </div>
        <p className={cn('mt-2 font-body text-xs', errors.pin ? 'text-status-out' : 'text-ink-faint')} role={errors.pin ? 'alert' : undefined}>
          {errors.pin ?? 'Zoom in close. Crews use this pin to find you.'}
        </p>

        {/* Live address, written by the app */}
        <motion.div
          key={`${area.id}-${place.landmark?.id}`}
          initial={{ opacity: 0.5, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 rounded-lg bg-canvas p-4"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <MapPinIcon className="mt-0.5 h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-body text-sm font-semibold text-ink">{touched ? place.summary : 'Pick a spot to see its address'}</p>
              <p className="mt-0.5 font-body text-xs text-ink-muted">
                {area.name} · {area.feeder} · Band {area.band} ({bandHours[area.band]} hrs/day promised)
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="font-body text-xs text-ink-muted">
              Plus code <span className="font-semibold tabular-nums text-ink">{place.plusCode}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(place.plusCode).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                });
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 font-body text-xs font-semibold text-ink hover:bg-sunken"
            >
              {copied ? <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> : <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </motion.div>
      </div>

      {touched && (
        <fieldset>
          <legend className="font-body text-sm font-medium text-ink">
            {match.confident || chosenArea ? 'Area' : 'Which area is this in?'}
          </legend>
          <p className={cn('mt-1 font-body text-xs', match.confident || chosenArea ? 'text-ink-faint' : 'text-status-low')}>
            {match.confident || chosenArea
              ? 'Wrong? Pick the right one and we’ll remember it for this spot.'
              : gps && gps.accuracy > ROUGH_FIX_METERS
                ? `Your location is rough (±${Math.round(gps.accuracy)} m), so we’re not sure. Pick yours.`
                : 'This spot is near a boundary. Pick the area people would say it’s in.'}
          </p>
          <div role="radiogroup" className="mt-2 flex flex-wrap gap-1.5">
            {[...areaOptions, ...(chosenArea && !areaOptions.some((a) => a.id === chosenArea) ? [areaById[chosenArea]] : [])].map((a) => {
              const active = a.id === area.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setChosenArea(a.id)}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 font-body text-sm font-medium transition-colors',
                    active ? 'bg-ink text-canvas' : 'border border-line-strong bg-surface text-ink hover:border-ink',
                  )}
                >
                  {active && <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                  {a.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* 3. Describe it */}
      <fieldset>
        <legend className="font-body text-sm font-medium text-ink">What is this place?</legend>
        <p className="mt-1 font-body text-xs text-ink-faint">Students often save a hostel and a home. Traders save their shop.</p>
        <div role="radiogroup" className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {(Object.keys(placeLabels) as PlaceLabel[]).map((l) => {
            const Icon = labelIcon[l];
            const active = label === l;
            return (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setLabel(l)}
                className={cn(
                  'inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 font-body text-sm font-medium transition-colors',
                  active ? 'bg-ink text-canvas' : 'border border-line bg-surface text-ink hover:bg-canvas',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {placeLabels[l]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <AnimatePresence initial={false}>
        {label === 'other' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <TextField
              label="Name this place"
              hint="Only you see this name."
              placeholder="e.g. Mum’s house, Church"
              value={customName}
              error={errors.name}
              onChange={(e) => {
                setCustomName(e.target.value);
                setErrors((er) => ({ ...er, name: undefined }));
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <TextField
        label="Directions for the crew"
        hint="How would a neighbour describe it? Gate colour, what it’s opposite or behind."
        placeholder="e.g. Blue gate after the pharmacy, opposite the church"
        value={directions}
        onChange={(e) => setDirections(e.target.value)}
        optional
      />

      <TextField
        label="Prepaid meter number"
        hint="Printed on your meter. Helps EEDC match you to the exact transformer."
        placeholder="e.g. 0123 4567 8901"
        inputMode="numeric"
        value={meter}
        error={errors.meter}
        onChange={(e) => {
          setMeter(e.target.value.replace(/[^\d ]/g, ''));
          setErrors((er) => ({ ...er, meter: undefined }));
        }}
        optional
      />

      <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
        <Button size="lg" full onClick={save}>
          {saveText}
        </Button>
        {onCancel && (
          <Button size="lg" full variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
