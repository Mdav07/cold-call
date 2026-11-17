"use client";

import { useEffect, useState } from "react";
import type { EmployeeId, ProposalKind, ProposalStatus, RunOutcome } from "@/shared/interfaces";

export interface RunState {
  level: number;
  locked_out: boolean;
  reason: { delta: number; text: string } | null;
  proposal: {
    kind: ProposalKind;
    status: ProposalStatus;
    amount_units: string | null;
    claimed_name: string | null;
    unlock_at: string | null;
  } | null;
  run: {
    floor: number;
    outcome: RunOutcome | null;
    tx_hash: string | null;
    ended_at: string | null;
    duration_ms: number | null;
    payout_units: string | number | null;
  } | null;
}

/** Polls /api/session/state while `active`. Replaced by Supabase Realtime once players sign in. */
export function useRunState(runId: string | null, employeeId: EmployeeId, active: boolean, everyMs = 1500) {
  const [state, setState] = useState<RunState | null>(null);

  const finished = !!state?.run?.ended_at;

  useEffect(() => {
    if (!runId) return;
    let stopped = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/session/state?run_id=${runId}&employee_id=${employeeId}`, { cache: "no-store" });
        if (res.ok && !stopped) setState(await res.json());
      } catch {
        // transient; the next poll retries
      }
    };
    load();
    // Keep polling until the run is over, even between calls: a payout can land after a hang-up.
    if (!active || finished) return () => void (stopped = true);
    const t = setInterval(load, everyMs);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [runId, employeeId, active, finished, everyMs]);

  return state;
}
