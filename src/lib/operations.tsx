'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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

interface OpsState {
  staff: Staff[];
  teams: Team[];
  /** Who is using the operator dashboard in this browser (until Clerk is wired). */
  actingAsId: string;
}

const seed: OpsState = { staff: seedStaff, teams: seedTeams, actingAsId: 's-adaobi' };

const STORAGE_KEY = 'voltiq.operations.v1';

interface OpsContextValue extends OpsState {
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

/**
 * Mock operations store (staff, roles, teams) persisted to localStorage, the
 * same way ProfileProvider is. Swap `commit` for server actions writing to the
 * users / teams tables once auth exists — the API stays the same.
 */
export function OperationsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OpsState>(seed);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...seed, ...(JSON.parse(raw) as Partial<OpsState>) });
    } catch {
      /* corrupted storage: keep the seed */
    }
  }, []);

  const commit = useCallback((next: (s: OpsState) => OpsState) => {
    setState((prev) => {
      const value = next(prev);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch {
        /* storage full or blocked: keep it in memory */
      }
      return value;
    });
  }, []);

  const value = useMemo<OpsContextValue>(() => {
    const { staff, teams } = state;
    const staffById = (id: string | null | undefined) => (id ? staff.find((s) => s.id === id) : undefined);
    const actingAs = staffById(state.actingAsId) ?? staff[0];
    const membersOf = (teamId: string) => staff.filter((s) => s.teamId === teamId);
    const leadOf = (teamId: string) => staffById(teams.find((t) => t.id === teamId)?.leadId);

    return {
      ...state,
      actingAs,
      allowed: (p) => can(actingAs.role, p),
      setActingAs: (actingAsId) => commit((s) => ({ ...s, actingAsId })),
      staffById,
      membersOf,
      leadOf,
      leadName: (teamId) => leadOf(teamId)?.name ?? 'No lead yet',
      healthOf: (teamId) => {
        const team = teams.find((t) => t.id === teamId);
        if (!team) throw new Error(`Unknown team ${teamId}`);
        return teamHealth(team, membersOf(teamId));
      },
      assignLead: (teamId, staffId) =>
        commit((s) => {
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
        }),
      setRole: (staffId, role) =>
        commit((s) => ({
          ...s,
          staff: s.staff.map((p) =>
            p.id !== staffId
              ? p
              : // Office roles don't sit on a field team.
                { ...p, role, teamId: role === 'manager' || role === 'dispatcher' ? null : p.teamId },
          ),
          // Someone who stops being a lead stops leading their team.
          teams: role === 'team_lead' ? s.teams : s.teams.map((t) => (t.leadId === staffId ? { ...t, leadId: null, leadAssignedBy: null } : t)),
        })),
      moveToTeam: (staffId, teamId) =>
        commit((s) => ({
          ...s,
          staff: s.staff.map((p) =>
            p.id !== staffId ? p : { ...p, teamId, role: p.role === 'manager' || p.role === 'dispatcher' ? 'technician' : p.role },
          ),
          // A lead who moves leaves their old team leaderless.
          teams: s.teams.map((t) => (t.leadId === staffId && t.id !== teamId ? { ...t, leadId: null, leadAssignedBy: null } : t)),
        })),
      toggleShift: (staffId) =>
        commit((s) => ({
          ...s,
          staff: s.staff.map((p) => (p.id === staffId ? { ...p, onShift: !p.onShift, shiftHours: p.onShift ? 0 : p.shiftHours } : p)),
        })),
      createTeam: (name, zone) => {
        const id = `c-${Date.now().toString(36)}`;
        commit((s) => ({
          ...s,
          teams: [
            ...s.teams,
            { id, name, leadId: null, leadAssignedBy: null, zone, vehicle: 'ok', jobsCompleted: 0, responseMinutes: 0, repairMinutes: 0, slaPercent: 100, callbacks: 0 },
          ],
        }));
        return id;
      },
      renameTeam: (teamId, name) => commit((s) => ({ ...s, teams: s.teams.map((t) => (t.id === teamId ? { ...t, name } : t)) })),
      reset: () => commit(() => seed),
    };
  }, [state, commit]);

  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}

export function useOperations() {
  const ctx = useContext(OpsContext);
  if (!ctx) throw new Error('useOperations must be used inside OperationsProvider');
  return ctx;
}
