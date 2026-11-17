// B's tool handlers: report_suspicion and end_conversation. A's route wraps these with its
// session check (secret, run active, session belongs to run + employee) before calling them.

import directory from "@/content/plumpurse/directory.json";
import { db } from "@/server/chain/db";
import { onRunEnded } from "@/server/chain/ingest";
import type {
  EmployeeId,
  EndConversationInput,
  EndConversationResult,
  ReportSuspicionInput,
  ReportSuspicionResult,
} from "@/shared/interfaces";

/** Where each employee's meter starts on a fresh run (from the rule sheets). */
export const STARTING_SUSPICION: Record<EmployeeId, number> = {
  barry: 0,
  penny: 10,
  dee: 15,
  annie: 20,
  bill: 30,
  cassius: 40,
  max: 20,
};

/** A locked-out employee warns their floor-mate, whose meter starts at least here. */
export const WARNED_START = 30;
export const LOCKOUT = 100;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function floorMates(employee: EmployeeId): EmployeeId[] {
  const me = directory.employees.find((e) => e.id === employee);
  return directory.employees
    .filter((e) => e.is_signer && e.floor === me?.floor && e.id !== employee)
    .map((e) => e.id as EmployeeId);
}

async function latestLevel(runId: string, employee: EmployeeId): Promise<number | null> {
  const { data } = await db()
    .from("suspicion_events")
    .select("level_after")
    .eq("run_id", runId)
    .eq("employee_id", employee)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .throwOnError();
  return data ? data.level_after : null;
}

/** Current meter for one employee on a run, including the starting value and floor-mate warnings. */
export async function currentLevel(runId: string, employee: EmployeeId): Promise<number> {
  const last = await latestLevel(runId, employee);
  if (last != null) return last;
  let start = STARTING_SUSPICION[employee];
  for (const mate of floorMates(employee)) {
    if ((await latestLevel(runId, mate)) === LOCKOUT) start = Math.max(start, WARNED_START);
  }
  return start;
}

export async function reportSuspicion(input: ReportSuspicionInput): Promise<ReportSuspicionResult> {
  let delta = clamp(Math.round(Number(input.delta) || 0), -20, 40);
  const before = await currentLevel(input.run_id, input.employee_id);
  if (before >= LOCKOUT) return { level: LOCKOUT, locked_out: true };

  // Grudge: after a serious red flag (+30 or more at once: threats, talk about AI), flattery and
  // good evidence no longer lower this employee's guard for the rest of the run.
  if (delta < 0 && (await holdsGrudge(input.run_id, input.employee_id))) delta = 0;

  const level = clamp(before + delta, 0, LOCKOUT);
  await db()
    .from("suspicion_events")
    .insert({
      run_id: input.run_id,
      employee_id: input.employee_id,
      delta,
      reason: String(input.reason ?? "").slice(0, 200) || "(no reason given)",
      level_after: level,
    })
    .throwOnError();

  const locked_out = level >= LOCKOUT;
  if (locked_out) await endRunIfNoPathLeft(input.run_id, input.employee_id);
  return { level, locked_out };
}

/** A single increase this big makes the employee hold a grudge for the rest of the run. */
export const GRUDGE_DELTA = 30;

async function holdsGrudge(runId: string, employee: EmployeeId): Promise<boolean> {
  const { count } = await db()
    .from("suspicion_events")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId)
    .eq("employee_id", employee)
    .gte("delta", GRUDGE_DELTA)
    .throwOnError();
  return (count ?? 0) > 0;
}

/** The run fails once every signer on the floor has locked the player out. */
async function endRunIfNoPathLeft(runId: string, employee: EmployeeId): Promise<void> {
  for (const mate of floorMates(employee)) {
    if ((await latestLevel(runId, mate)) !== LOCKOUT) return;
  }
  await db()
    .from("runs")
    .update({ outcome: "lockout", ended_at: new Date().toISOString() })
    .eq("id", runId)
    .is("ended_at", null)
    .throwOnError();
  await onRunEnded(runId); // Floor 3: the player leaves the allowlist (A's helper, idempotent)
}

export async function endConversation(input: EndConversationInput): Promise<EndConversationResult> {
  await recordTalkTime(input.session_id);
  return { ended: true };
}

/** Sets seconds_used from the conversation's start to now. Idempotent enough: last call wins. */
export async function recordTalkTime(sessionId: string): Promise<void> {
  const { data } = await db()
    .from("conversations")
    .select("created_at")
    .eq("id", sessionId)
    .maybeSingle()
    .throwOnError();
  if (!data) return;
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(data.created_at)) / 1000));
  await db().from("conversations").update({ seconds_used: seconds }).eq("id", sessionId).throwOnError();
}
