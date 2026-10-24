'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { roleMeta, type StaffRole } from '@/data/operations';
import { ApiFailure } from '@/lib/api';
import { useOperations } from '@/lib/operations';

const roles = Object.keys(roleMeta) as StaffRole[];

/**
 * Add a colleague by work email. If they already use VoltIq as a resident they
 * are promoted; otherwise their account is linked the first time they sign in.
 */
export function AddStaffForm({ onDone }: { onDone: () => void }) {
  const { teams, addStaff } = useOperations();
  const toast = useToast();
  const [form, setForm] = useState({ email: '', name: '', role: 'technician' as StaffRole, teamId: '' });
  const [errors, setErrors] = useState<Partial<Record<'email' | 'name' | 'role' | 'form', string>>>({});
  const [saving, setSaving] = useState(false);
  const office = form.role === 'manager' || form.role === 'dispatcher';
  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined, form: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setErrors({ email: 'Enter their work email.' });
    setSaving(true);
    try {
      await addStaff({ email: form.email.trim(), name: form.name.trim(), role: form.role, teamId: office ? null : form.teamId || null });
      toast({
        title: `${form.name.trim() || form.email.trim()} added as ${roleMeta[form.role].label.toLowerCase()}`,
        body: 'They get access the first time they sign in with this email.',
      });
      onDone();
    } catch (err) {
      const f = err instanceof ApiFailure ? err : null;
      const field = f?.field === 'email' || f?.field === 'name' || f?.field === 'role' ? f.field : 'form';
      setErrors({ [field]: f?.message ?? 'Couldn’t add them. Try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
      onSubmit={submit}
    >
      <div className="grid gap-4 rounded-md bg-surface p-4 shadow-card sm:grid-cols-2">
        <TextField
          label="Work email"
          hint="They sign in to VoltIq with this address."
          placeholder="e.g. ada.nwosu@enugudisco.com"
          type="email"
          autoComplete="off"
          autoFocus
          value={form.email}
          error={errors.email}
          onChange={(e) => set('email')(e.target.value)}
        />
        <TextField
          label="Full name"
          hint="Leave empty if they already have a resident account."
          placeholder="e.g. Ada Nwosu"
          value={form.name}
          error={errors.name}
          onChange={(e) => set('name')(e.target.value)}
        />
        <Select
          label="Role"
          hint={roleMeta[form.role].description}
          value={form.role}
          error={errors.role}
          options={roles.map((r) => ({ value: r, label: roleMeta[r].label }))}
          onChange={(e) => set('role')(e.target.value)}
        />
        <Select
          label="Team"
          hint={office ? 'Managers and dispatchers work from the office, not a team.' : 'You can move them later.'}
          value={office ? '' : form.teamId}
          disabled={office}
          options={[{ value: '', label: 'Unassigned' }, ...teams.map((t) => ({ value: t.id, label: t.name }))]}
          onChange={(e) => set('teamId')(e.target.value)}
        />
        {errors.form && (
          <p role="alert" className="font-body text-sm text-status-out sm:col-span-2">
            {errors.form}
          </p>
        )}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={saving}>
            Add staff
          </Button>
        </div>
      </div>
    </motion.form>
  );
}
