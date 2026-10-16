'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  can,
  seedStaff,
  seedTeams,
  teamHealth,
  type Permission,
  type Staff,
  type StaffRole,
  type Team,
  type TeamHealth,
} from '@/data/operations';
import { api, ApiFailure } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import type { Org, OrgAction } from '@/server/operations';

interface OpsState {
  staff: Staff[];
  teams: Team[];
  /** The signed-in staff member (live), or who the demo is "acting as". */
  actingAsId: string;
}

const seed: OpsState = { staff: seedStaff, teams: seedTeams, actingAsId: 's-adaobi' };

const STORAGE_KEY = 'voltiq.operations.v2';

interface OpsContextValue extends OpsState {
  /** True when backed by the database (operator area); false for the local demo roster. */
  live: boolean;
  actingAs: Staff;
  allowed: (p: Permission) => boolean;
  setActingAs: (staffId: string) => void;
  staffById: (id: string | null | undefined) => Staff | undefined;
  membersOf: (teamId: string) => Staff[];
  leadOf: (teamId: string) => Staff | undefined;
  /** "Ngozi Okafor" or "No lead yet" — what residents see beside a team. */
  leadName: (teamId: string) => string;
  healthOf: (teamId: string) => TeamHealth;
  /** Manager only. Makes `staffId` the team's lead; the old lead stays on as a technician. */
  assignLead: (teamId: string, staffId: string) => void;
  setRole: (staffId: string, role: StaffRole) => void;
  moveToTeam: (staffId: string, teamId: string | null) => void;
  toggleShift: (staffId: string) => void;
  createTeam: (name: string, zone: string[]) => string;
  renameTeam: (teamId: string, name: string) => void;
  reset: () => void;
}

const OpsContext = createContext<OpsContextValue | null>(null);

/* Pure roster rules, applied instantly on screen; the server applies the same rules. */
const rules = {
  assignLead: (s: OpsState, teamId: string, staffId: string): OpsState => {
    const team = s.teams.find((t) => t.id === teamId);
    if (!team) return s;
    const oldLead = team.leadId;
    return {
      ...s,
      teams: s.teams.map((t) => (t.id === teamId ? { ...t, leadId: staffId, leadAssignedBy: s.actingAsId } : t)),
      staff: s.staff.map((p) => {
        if (p.id === staffId) return { ...p, role: 'team_lead', teamId };
        if (p.id === oldLead && oldLead !== staffId) return { ...p, role: 'technician' };
        return p;
      }),
    };
  },
  setRole: (s: OpsState, staffId: string, role: StaffRole): OpsState => ({
    ...s,
    staff: s.staff.map((p) =>
      p.id !== staffId ? p : { ...p, role, teamId: role === 'manager' || role === 'dispatcher' ? null : p.teamId },
    ),
    teams: role === 'team_lead' ? s.teams : s.teams.map((t) => (t.leadId === staffId ? { ...t, leadId: null, leadAssignedBy: null } : t)),
  }),
  moveToTeam: (s: OpsState, staffId: string, teamId: string | null): OpsState => ({
    ...s,
    staff: s.staff.map((p) =>
      p.id !== staffId ? p : { ...p, teamId, role: p.role === 'manager' || p.role === 'dispatcher' ? 'technician' : p.role },
    ),
    teams: s.teams.map((t) => (t.leadId === staffId && t.id !== teamId ? { ...t, leadId: null, leadAssignedBy: null } : t)),
  }),
  toggleShift: (s: OpsState, staffId: string): OpsState => ({
    ...s,
    staff: s.staff.map((p) => (p.id === staffId ? { ...p, onShift: !p.onShift } : p)),
  }),
  createTeam: (s: OpsState, id: string, name: string, zone: string[]): OpsState => ({
    ...s,
    teams: [...s.teams, { id, name, leadId: null, leadAssignedBy: null, zone, jobsRestored: 0, restoreMinutes: 0, within4h: 0 }],
  }),
  renameTeam: (s: OpsState, teamId: string, name: string): OpsState => ({
    ...s,
    teams: s.teams.map((t) => (t.id === teamId ? { ...t, name } : t)),
  }),
};

/**
 * Staff, roles and teams. With `initial` (the operator area, loaded on the
 * server) it is backed by Postgres: changes show instantly and are saved
 * through /api/operator/org, rolling back with a message if the server says
 * no. Without it, a local demo roster persisted to localStorage.
 */
export function OperationsProvider({ children, initial }: { children: React.ReactNode; initial?: Org }) {
  const live = Boolean(initial);
  const toast = useToast();
  const [state, setState] = useState<OpsState>(
    initial ? { staff: initial.staff, teams: initial.teams, actingAsId: initial.meId } : seed,
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (live) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...seed, ...(JSON.parse(raw) as Partial<OpsState>) });
    } catch {
      /* corrupted storage: keep the seed */
    }
  }, [live]);

  const commit = useCallback(
    (next: (s: OpsState) => OpsState, action?: OrgAction) => {
      const before = stateRef.current;
      const value = next(before);
      setState(value);
      if (!live) {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        } catch {
          /* storage full or blocked: keep it in memory */
        }
        return;
      }
      if (!action) return;
      api<Org>('/api/operator/org', { body: action })
        .then((org) => setState((s) => ({ ...s, staff: org.staff, teams: org.teams })))
        .catch((e) => {
          setState(before);
          toast({ title: 'Change not saved', body: e instanceof ApiFailure ? e.message : 'Try again in a moment.', color: 'var(--status-out)' });
        });
    },
    [live, toast],
  );

  const value = useMemo<OpsContextValue>(() => {
    const { staff, teams } = state;
    const staffById = (id: string | null | undefined) => (id ? staff.find((s) => s.id === id) : undefined);
    const actingAs = staffById(state.actingAsId) ?? staff[0] ?? seedStaff[0];
    const membersOf = (teamId: string) => staff.filter((s) => s.teamId === teamId);
    const leadOf = (teamId: string) => staffById(teams.find((t) => t.id === teamId)?.leadId);

    return {
      ...state,
      live,
      actingAs,
      allowed: (p) => can(actingAs.role, p),
      // Live: you are who you signed in as.
      setActingAs: (actingAsId) => {
        if (!live) commit((s) => ({ ...s, actingAsId }));
      },
      staffById,
      membersOf,
      leadOf,
      leadName: (teamId) => leadOf(teamId)?.name ?? 'No lead yet',
      healthOf: (teamId) => {
        const team = teams.find((t) => t.id === teamId);
        if (!team) return teamHealth({ id: teamId, name: '', leadId: null, leadAssignedBy: null, zone: [], jobsRestored: 0, restoreMinutes: 0, within4h: 0 }, []);
        return teamHealth(team, membersOf(teamId));
      },
      assignLead: (teamId, staffId) => commit((s) => rules.assignLead(s, teamId, staffId), { action: 'assignLead', teamId, staffId }),
      setRole: (staffId, role) => commit((s) => rules.setRole(s, staffId, role), { action: 'setRole', staffId, role }),
      moveToTeam: (staffId, teamId) => commit((s) => rules.moveToTeam(s, staffId, teamId), { action: 'moveToTeam', staffId, teamId }),
      toggleShift: (staffId) => commit((s) => rules.toggleShift(s, staffId), { action: 'toggleShift', staffId }),
      createTeam: (name, zone) => {
        // Temporary id until the server's roster comes back.
        const id = `c-${Date.now().toString(36)}`;
        commit((s) => rules.createTeam(s, id, name, zone), { action: 'createTeam', name, zone });
        return id;
      },
      renameTeam: (teamId, name) => commit((s) => rules.renameTeam(s, teamId, name), { action: 'renameTeam', teamId, name }),
      reset: () => {
        if (!live) commit(() => seed);
      },
    };
  }, [state, commit, live]);

  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}

export function useOperations() {
  const ctx = useContext(OpsContext);
  if (!ctx) throw new Error('useOperations must be used inside OperationsProvider');
  return ctx;
}
