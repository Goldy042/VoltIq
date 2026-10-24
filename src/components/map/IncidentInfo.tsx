'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ClockIcon, MegaphoneIcon, WrenchIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import type { Incident } from '@/data/nsukka';
import { useSharedOutageFeed } from '@/hooks/useOutageFeed';
import { ApiFailure } from '@/lib/api';
import { CAUSES, MAX_ETA_HOURS, PUBLIC_NOTE_MAX, formatEta, type Cause } from '@/lib/incidents';
import { formatAgo } from '@/lib/geo';

/** What EEDC has told residents about this outage: cause, expected fix time, latest update. */
export function EedcUpdate({ incident }: { incident: Incident }) {
  const cause = incident.cause && incident.cause in CAUSES ? CAUSES[incident.cause as Cause] : null;
  if (!cause && !incident.etaAt && !incident.publicNote) return null;
  const late = incident.etaAt && new Date(incident.etaAt).getTime() < Date.now();
  const noteAgo = incident.publicNoteAt ? Math.max(0, Math.round((Date.now() - new Date(incident.publicNoteAt).getTime()) / 60_000)) : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label="Update from EEDC"
      className="mt-5 space-y-3 rounded-md border border-line p-4"
    >
      <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-faint">From EEDC</p>
      {incident.etaAt && incident.status !== 'restored' && (
        <p className="flex items-start gap-2.5 font-body text-sm text-ink">
          <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          <span>
            <span className="font-semibold">Expected back {formatEta(incident.etaAt)}</span>
            {late && <span className="block text-xs text-status-low">Running late. EEDC hasn’t posted a new time yet.</span>}
          </span>
        </p>
      )}
      {cause && (
        <p className="flex items-start gap-2.5 font-body text-sm text-ink">
          <WrenchIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          {cause}
        </p>
      )}
      {incident.publicNote && (
        <p className="flex items-start gap-2.5 font-body text-sm leading-body text-ink">
          <MegaphoneIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          <span>
            {incident.publicNote}
            {noteAgo !== null && <span className="block text-xs text-ink-faint">{formatAgo(noteAgo)}</span>}
          </span>
        </p>
      )}
    </motion.section>
  );
}

/** <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm". */
function toLocalInput(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Field = 'etaAt' | 'cause' | 'publicNote' | 'form';

/** Operator form: tell residents the cause, when light should be back, and what's happening. */
export function IncidentInfoForm({ incident, onSaved }: { incident: Incident; onSaved?: () => void }) {
  const { updateInfo } = useSharedOutageFeed();
  const toast = useToast();
  const [eta, setEta] = useState(toLocalInput(incident.etaAt));
  const [cause, setCause] = useState(incident.cause ?? '');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);

  // Another outage selected, or someone else saved: start from what's stored.
  useEffect(() => {
    setEta(toLocalInput(incident.etaAt));
    setCause(incident.cause ?? '');
    setNote('');
    setErrors({});
  }, [incident.id, incident.etaAt, incident.cause]);

  const dirty = eta !== toLocalInput(incident.etaAt) || cause !== (incident.cause ?? '') || note.trim() !== '';

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    setErrors({});
    try {
      await updateInfo(incident.id, {
        etaAt: eta ? new Date(eta).toISOString() : null,
        cause: cause || null,
        ...(note.trim() && { publicNote: note.trim() }),
      });
      setNote('');
      onSaved?.();
      toast({ title: 'Residents updated', body: 'Everyone affected gets this in their alerts.' });
    } catch (err) {
      const f = err instanceof ApiFailure ? err : null;
      const field = (['etaAt', 'cause', 'publicNote'] as const).find((k) => k === f?.field) ?? 'form';
      setErrors({ [field]: f?.message ?? 'Couldn’t save. Try again.' });
    } finally {
      setSaving(false);
    }
  };

  const now = new Date();
  return (
    <form onSubmit={save} className="space-y-3 rounded-lg border border-line p-3">
      <div className="px-1">
        <p className="font-body text-sm font-semibold text-ink">Update residents</p>
        <p className="font-body text-xs text-ink-faint">Shown on the map and sent to everyone affected.</p>
      </div>
      <Select
        label="Cause"
        hint="Plain words residents will see."
        placeholder="Choose a cause"
        value={cause}
        error={errors.cause}
        options={Object.entries(CAUSES).map(([value, label]) => ({ value, label }))}
        onChange={(e) => setCause(e.target.value)}
      />
      <TextField
        label="Expected back"
        hint={`Your best estimate, within ${MAX_ETA_HOURS} hours. Change it if things slip.`}
        optional
        type="datetime-local"
        min={toLocalInput(now.toISOString())}
        max={toLocalInput(new Date(now.getTime() + MAX_ETA_HOURS * 3_600_000).toISOString())}
        value={eta}
        error={errors.etaAt}
        onChange={(e) => setEta(e.target.value)}
      />
      <TextArea
        label="Public update"
        hint={`${note.length}/${PUBLIC_NOTE_MAX}. No staff names or phone numbers.`}
        optional
        placeholder="e.g. The team is replacing a blown fuse on the Odim transformer."
        maxLength={PUBLIC_NOTE_MAX}
        value={note}
        error={errors.publicNote}
        onChange={(e) => setNote(e.target.value)}
      />
      {errors.form && (
        <p role="alert" className="px-1 font-body text-sm text-status-out">
          {errors.form}
        </p>
      )}
      <Button type="submit" full variant="secondary" disabled={!dirty} loading={saving} leading={<MegaphoneIcon className="h-4 w-4" aria-hidden="true" />}>
        Post update
      </Button>
    </form>
  );
}
