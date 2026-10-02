'use client';

import React, { useMemo, useState } from 'react';
import { CheckIcon, LockIcon, MinusIcon, SearchIcon } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { permissionLabel, roleMeta, type Permission, type StaffRole } from '@/data/operations';
import { useOperations } from '@/lib/operations';
import { Avatar, Card, FilterPill, Page, PageHeader } from './parts';

const roles = Object.keys(roleMeta) as StaffRole[];
const permissions = Object.keys(permissionLabel) as Permission[];

export function OperatorStaff() {
  const toast = useToast();
  const { staff, teams, allowed, actingAs, setRole, moveToTeam, toggleShift } = useOperations();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<StaffRole | 'all'>('all');
  const canRoles = allowed('manage_roles');
  const canTeams = allowed('manage_teams');
  const managers = staff.filter((s) => s.role === 'manager').length;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff
      .filter((s) => (roleFilter === 'all' || s.role === roleFilter) && (!q || s.name.toLowerCase().includes(q)))
      .sort((a, b) => roles.indexOf(a.role) - roles.indexOf(b.role) || a.name.localeCompare(b.name));
  }, [staff, query, roleFilter]);

  const leads = new Map(teams.filter((t) => t.leadId).map((t) => [t.leadId!, t]));

  return (
    <Page>
      <PageHeader
        title="Roles & staff"
        subtitle={
          canRoles ? (
            'Set what each person can do. Team leads are chosen per team on the Teams page.'
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <LockIcon className="h-3.5 w-3.5" aria-hidden="true" /> You’re viewing as {roleMeta[actingAs.role].label.toLowerCase()}. Only managers can change roles.
            </span>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {roles.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={roleFilter === r}
            onClick={() => setRoleFilter((f) => (f === r ? 'all' : r))}
            className={`rounded-lg p-4 text-left shadow-card transition-colors ${roleFilter === r ? 'bg-ink text-canvas' : 'bg-surface text-ink hover:bg-canvas'}`}
          >
            <p className="font-display text-2xl font-bold leading-none tabular-nums">{staff.filter((s) => s.role === r).length}</p>
            <p className="mt-2 font-body text-sm font-semibold">{roleMeta[r].label}s</p>
            <p className={`mt-1 font-body text-xs leading-snug ${roleFilter === r ? 'opacity-70' : 'text-ink-muted'}`}>{roleMeta[r].description}</p>
          </button>
        ))}
      </div>

      <Card title="Staff">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search staff</span>
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name"
              className="h-10 w-full rounded-full border border-line bg-surface pl-10 pr-4 font-body text-sm text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none"
            />
          </label>
          {roleFilter !== 'all' && (
            <FilterPill label={`Showing ${roleMeta[roleFilter].label.toLowerCase()}s · show everyone`} active onClick={() => setRoleFilter('all')} />
          )}
        </div>
        <ul className="divide-y divide-line">
          {shown.map((s) => {
            const office = s.role === 'manager' || s.role === 'dispatcher';
            const lastManager = s.role === 'manager' && managers === 1;
            const leading = leads.get(s.id);
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 font-body text-sm">
                <div className="flex min-w-0 flex-1 basis-56 items-center gap-2.5">
                  <Avatar name={s.name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">
                      {s.name}
                      {s.id === actingAs.id && <span className="ml-1.5 font-normal text-ink-faint">(you)</span>}
                    </p>
                    <p className="text-xs tabular-nums text-ink-faint">
                      {s.phone}
                      {s.role === 'team_lead' && ` · ${leading ? `Leads ${leading.name}` : 'Not leading a team yet'}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!canTeams}
                  onClick={() => toggleShift(s.id)}
                  className={`h-8 shrink-0 rounded-full px-3 text-xs font-medium disabled:cursor-default sm:order-last ${s.onShift ? 'bg-canvas text-status-restored' : 'bg-sunken text-ink-muted'}`}
                >
                  {s.onShift ? 'On shift' : 'Off shift'}
                </button>
                <div className="grid w-full grid-cols-2 items-center gap-2 sm:flex sm:w-auto">
                  {canRoles ? (
                    <select
                      aria-label={`Role for ${s.name}`}
                      value={s.role}
                      disabled={lastManager}
                      title={lastManager ? 'The district needs at least one manager' : undefined}
                      onChange={(e) => {
                        const role = e.target.value as StaffRole;
                        setRole(s.id, role);
                        toast({
                          title: `${s.name} is now ${roleMeta[role].label.toLowerCase()}`,
                          body: role === 'team_lead' ? 'Make them lead of a team on the Teams page.' : roleMeta[role].description,
                        });
                      }}
                      className="h-9 w-full min-w-0 rounded-full border border-line bg-surface px-3 text-sm text-ink focus:border-ink focus:outline-none disabled:opacity-60 sm:w-40"
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {roleMeta[r].label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-ink">{roleMeta[s.role].label}</span>
                  )}
                  {office ? (
                    <span className="px-1 text-ink-faint sm:w-36">Office</span>
                  ) : canTeams ? (
                    <select
                      aria-label={`Team for ${s.name}`}
                      value={s.teamId ?? ''}
                      onChange={(e) => {
                        moveToTeam(s.id, e.target.value || null);
                        const t = teams.find((x) => x.id === e.target.value);
                        toast({ title: t ? `${s.name} moved to ${t.name}` : `${s.name} is unassigned` });
                      }}
                      className="h-9 w-full min-w-0 rounded-full border border-line bg-surface px-3 text-sm text-ink focus:border-ink focus:outline-none sm:w-36"
                    >
                      <option value="">Unassigned</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-ink-muted">· {teams.find((t) => t.id === s.teamId)?.name ?? 'Unassigned'}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="What each role can do">
        {/* Phones: one block per role */}
        <div className="space-y-3 md:hidden">
          {roles.map((r) => (
            <div key={r} className="rounded-md bg-canvas p-3">
              <p className="font-body text-sm font-semibold text-ink">{roleMeta[r].label}</p>
              <ul className="mt-1.5 space-y-1">
                {roleMeta[r].permissions.map((p) => (
                  <li key={p} className="flex items-center gap-2 font-body text-xs text-ink-muted">
                    <CheckIcon className="h-3.5 w-3.5 shrink-0 text-status-restored" aria-hidden="true" />
                    {permissionLabel[p]}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="-mx-4 hidden md:block lg:-mx-5">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-faint">
                <th className="px-4 py-2 text-left font-medium lg:px-5">Permission</th>
                {roles.map((r) => (
                  <th key={r} className="px-2 py-2 text-center font-medium">
                    {roleMeta[r].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {permissions.map((p) => (
                <tr key={p}>
                  <td className="px-4 py-2.5 text-ink lg:px-5">{permissionLabel[p]}</td>
                  {roles.map((r) => {
                    const yes = roleMeta[r].permissions.includes(p);
                    return (
                      <td key={r} className="px-2 py-2.5 text-center">
                        {yes ? (
                          <CheckIcon className="mx-auto h-4 w-4 text-status-restored" aria-label="Yes" />
                        ) : (
                          <MinusIcon className="mx-auto h-4 w-4 text-ink-faint" aria-label="No" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Page>
  );
}
