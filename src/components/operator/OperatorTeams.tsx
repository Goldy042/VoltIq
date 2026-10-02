'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { CrownIcon, LockIcon, PlusIcon, TruckIcon, UserMinusIcon, WrenchIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { useToast } from '@/components/ui/Toast';
import { areas, type Crew } from '@/data/nsukka';
import { roleMeta, vehicleLabel, type Team } from '@/data/operations';
import { useSharedOutageFeed } from '@/hooks/useOutageFeed';
import { useOperations } from '@/lib/operations';
import { Avatar, CrewStatusPill, HealthBadge, Page, PageHeader } from './parts';

const feeders = [...new Set(areas.map((a) => a.feeder))];

export function OperatorTeams() {
  const { teams, allowed, createTeam } = useOperations();
  const { crews, incidents } = useSharedOutageFeed();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [zone, setZone] = useState<string[]>([]);
  const canManage = allowed('manage_teams');

  return (
    <Page>
      <PageHeader
        title="Teams"
        subtitle="Each team’s lead is assigned by a manager. Residents see the lead’s name beside the team on the map and in repair updates."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setCreating((c) => !c)} leading={<PlusIcon className="h-4 w-4" aria-hidden="true" />}>
              New team
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-body text-xs text-ink-muted">
              <LockIcon className="h-3.5 w-3.5" aria-hidden="true" /> Only managers can change teams
            </span>
          )
        }
      />

      <AnimatePresence>
        {creating && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              createTeam(name.trim(), zone);
              toast({ title: `${name.trim()} created`, body: 'Add members, then assign a lead.' });
              setName('');
              setZone([]);
              setCreating(false);
            }}
          >
            <div className="space-y-3 rounded-lg bg-surface p-4 shadow-card">
              <label className="block">
                <span className="font-body text-sm font-medium text-ink">Team name</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Crew Echo"
                  className="mt-1.5 h-11 w-full rounded-md border border-line bg-surface px-3 font-body text-sm text-ink focus:border-ink focus:outline-none"
                />
              </label>
              <fieldset>
                <legend className="font-body text-sm font-medium text-ink">Feeders they cover first</legend>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {feeders.map((f) => {
                    const on = zone.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setZone((z) => (on ? z.filter((x) => x !== f) : [...z, f]))}
                        className={cn(
                          'h-8 rounded-full px-3 font-body text-xs font-medium',
                          on ? 'bg-ink text-canvas' : 'border border-line-strong text-ink hover:border-ink',
                        )}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={!name.trim()}>
                  Create team
                </Button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {teams.map((t) => (
          <TeamCard key={t.id} team={t} crew={crews.find((c) => c.id === t.id)} jobPlace={incidents.find((i) => i.id === crews.find((c) => c.id === t.id)?.incidentId)?.place} />
        ))}
      </div>
    </Page>
  );
}

function TeamCard({ team, crew, jobPlace }: { team: Team; crew?: Crew; jobPlace?: string }) {
  const toast = useToast();
  const { staff, teams, allowed, membersOf, leadOf, staffById, healthOf, assignLead, moveToTeam, toggleShift } = useOperations();
  const members = membersOf(team.id);
  const lead = leadOf(team.id);
  const health = healthOf(team.id);
  const assignedBy = staffById(team.leadAssignedBy);
  const canAssign = allowed('assign_leads');
  const canManage = allowed('manage_teams');
  // Anyone in the field can join; office staff stay in the office.
  const joinable = staff.filter((s) => s.teamId !== team.id && (s.role === 'technician' || (s.role === 'team_lead' && !s.teamId)));

  return (
    <article className="flex min-w-0 flex-col rounded-lg bg-surface p-4 shadow-card lg:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold tracking-tight text-ink">{team.name}</h2>
          <p className="mt-0.5 truncate font-body text-xs text-ink-muted">{team.zone.length ? team.zone.join(' · ') : 'No feeders yet'}</p>
        </div>
        <HealthBadge level={health.level} score={health.score} />
      </header>

      {/* Lead: the name residents see */}
      <div className="mt-4 rounded-md bg-canvas p-3">
        <div className="flex items-center gap-3">
          {lead ? <Avatar name={lead.name} /> : <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-line-strong" aria-hidden="true" />}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-body text-sm font-semibold text-ink">
              {lead ? lead.name : 'No lead yet'}
              {lead && <CrownIcon className="h-3.5 w-3.5 text-volt" aria-label="Team lead" />}
            </p>
            <p className="font-body text-xs text-ink-muted">
              {lead ? (assignedBy ? `Lead · assigned by ${assignedBy.name}` : 'Lead') : 'Residents see “No lead yet” beside this team'}
            </p>
          </div>
        </div>
        {canAssign ? (
          <label className="mt-3 block">
            <span className="sr-only">Assign lead for {team.name}</span>
            <select
              value={lead?.id ?? ''}
              onChange={(e) => {
                const next = staffById(e.target.value);
                if (!next) return;
                assignLead(team.id, next.id);
                toast({
                  title: `${next.name} now leads ${team.name}`,
                  body: 'Residents will see their name beside the team.',
                  icon: <CrownIcon className="h-4 w-4" />,
                  color: 'var(--ink)',
                });
              }}
              className="h-10 w-full rounded-full border border-line bg-surface px-4 font-body text-sm text-ink focus:border-ink focus:outline-none"
            >
              <option value="" disabled>
                Choose a lead…
              </option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.id === lead?.id ? ' (current lead)' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="mt-2 flex items-center gap-1.5 font-body text-xs text-ink-faint">
            <LockIcon className="h-3 w-3" aria-hidden="true" /> Only a manager can assign the lead
          </p>
        )}
      </div>

      {/* Live status */}
      <div className="mt-4 flex flex-wrap items-center gap-2 font-body text-xs text-ink-muted">
        {crew ? <CrewStatusPill status={crew.status} /> : <span className="rounded-full bg-sunken px-2 py-1">Not on the map yet</span>}
        {crew?.incidentId && jobPlace && (
          <Link href={`/operator/map?focus=${crew.incidentId}`} className="inline-flex items-center gap-1 text-accent hover:underline">
            <TruckIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {jobPlace}
            {crew.status === 'en_route' && crew.etaMinutes !== undefined && ` · ${crew.etaMinutes} min`}
          </Link>
        )}
        <span className="inline-flex items-center gap-1">
          <WrenchIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {vehicleLabel[team.vehicle]}
        </span>
      </div>

      {/* Health */}
      <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
        <Metric label="Jobs, 7 d" value={team.jobsCompleted} />
        <Metric label="Response" value={team.jobsCompleted ? `${team.responseMinutes}m` : '—'} />
        <Metric label="Repair" value={team.jobsCompleted ? `${team.repairMinutes}m` : '—'} />
        <Metric label="Within 4 hr" value={team.jobsCompleted ? `${team.slaPercent}%` : '—'} />
      </dl>
      {health.issues.length > 0 && (
        <ul className="mt-3 space-y-1">
          {health.issues.map((i) => (
            <li key={i} className="flex items-center gap-2 font-body text-xs text-ink-muted">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-low" aria-hidden="true" />
              {i}
            </li>
          ))}
        </ul>
      )}

      {/* Members */}
      <div className="mt-4 border-t border-line pt-3">
        <p className="font-body text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Members · {health.onShift}/{health.size} on shift
        </p>
        <ul className="mt-2 divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2.5 py-2">
              <Avatar name={m.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm text-ink">
                  {m.name}
                  {m.id === lead?.id && <span className="ml-1.5 font-body text-xs text-ink-faint">Lead</span>}
                </p>
                <p className="font-body text-xs text-ink-faint">
                  {roleMeta[m.role].label}
                  {m.onShift ? ` · ${m.shiftHours} hr on shift` : ' · off shift'}
                </p>
              </div>
              <button
                type="button"
                disabled={!canManage}
                onClick={() => toggleShift(m.id)}
                className={cn(
                  'h-7 rounded-full px-2.5 font-body text-xs font-medium disabled:cursor-default',
                  m.onShift ? 'bg-canvas text-status-restored' : 'bg-sunken text-ink-muted',
                )}
                aria-label={`${m.name} is ${m.onShift ? 'on' : 'off'} shift${canManage ? '. Toggle' : ''}`}
              >
                {m.onShift ? 'On shift' : 'Off'}
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    moveToTeam(m.id, null);
                    toast({ title: `${m.name} removed from ${team.name}`, body: m.id === lead?.id ? 'The team needs a new lead.' : 'They are now unassigned.' });
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-ink-faint hover:bg-sunken hover:text-ink"
                  aria-label={`Remove ${m.name} from ${team.name}`}
                >
                  <UserMinusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
          {members.length === 0 && <li className="py-2 font-body text-sm text-ink-muted">No members yet.</li>}
        </ul>
        {canManage && joinable.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              const p = staffById(e.target.value);
              if (!p) return;
              moveToTeam(p.id, team.id);
              toast({ title: `${p.name} joined ${team.name}` });
            }}
            className="mt-2 h-9 w-full rounded-full border border-dashed border-line-strong bg-surface px-4 font-body text-sm text-ink-muted focus:border-ink focus:outline-none"
            aria-label={`Add a member to ${team.name}`}
          >
            <option value="">+ Add member…</option>
            {joinable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.teamId ? ` (from ${teams.find((t) => t.id === s.teamId)?.name ?? 'another team'})` : ' (unassigned)'}
              </option>
            ))}
          </select>
        )}
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse rounded-md bg-canvas px-1 py-2">
      <dt className="mt-1 font-body text-2xs text-ink-faint">{label}</dt>
      <dd className="font-display text-lg font-bold leading-none tabular-nums text-ink">{value}</dd>
    </div>
  );
}
