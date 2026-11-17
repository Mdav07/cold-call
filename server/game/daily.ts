// Daily Contract and streaks (written by A for B, by agreement).
// A day is the UTC date, the same rule server/game/session.ts uses to pick today's modifier.
import { db } from "@/server/chain/db";

export interface DailyContract {
  id: string;
  date: string; // YYYY-MM-DD (UTC)
  floor: number;
  modifier: string;
}

export interface DailyState {
  contract: DailyContract | null;
  /** The player cleared today's contract (always false with no user). */
  clearedToday: boolean;
  streak: { current: number; longest: number };
}

export function dayOf(ms: number = Date.now()): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function previousDay(day: string): string {
  return dayOf(Date.parse(`${day}T00:00:00Z`) - 86_400_000);
}

export async function contractFor(day: string = dayOf()): Promise<DailyContract | null> {
  const { data } = await db().from("daily_contracts").select("*").eq("date", day).maybeSingle().throwOnError();
  return (data as DailyContract | null) ?? null;
}

async function clearedContract(userId: string, contractId: string): Promise<boolean> {
  const { count } = await db()
    .from("runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("daily_contract_id", contractId)
    .eq("outcome", "breach")
    .throwOnError();
  return (count ?? 0) > 0;
}

/**
 * True if a run on this floor right now is a paid Daily Contract attempt:
 * today's contract is on this floor and the player has not cleared it yet today.
 * Used by the payout rule (full amount on a Daily Contract clear, once per day).
 */
export async function isPaidDailyAttempt(userId: string, floor: number): Promise<boolean> {
  const c = await contractFor();
  if (!c || c.floor !== floor) return false;
  return !(await clearedContract(userId, c.id));
}

/**
 * Called once per breach (from the chain ingest). If the breach day's contract is on the run's
 * floor, it marks the run as a Daily Contract clear and updates the player's streak:
 * the day after the last completed day adds 1; a gap starts again at 1; the same day changes nothing.
 */
export async function recordBreach(runId: string, breachTimeMs: number): Promise<void> {
  const { data: run } = await db().from("runs").select("user_id, floor").eq("id", runId).maybeSingle().throwOnError();
  if (!run) return;
  const day = dayOf(breachTimeMs);
  const c = await contractFor(day);
  if (!c || c.floor !== run.floor) return;

  const firstToday = !(await clearedContract(run.user_id, c.id));
  await db().from("runs").update({ daily_contract_id: c.id }).eq("id", runId).throwOnError();
  if (!firstToday) return;

  const { data: s } = await db().from("streaks").select("*").eq("user_id", run.user_id).maybeSingle().throwOnError();
  if (s?.last_completed_date === day) return;
  const current = s?.last_completed_date === previousDay(day) ? s.current + 1 : 1;
  await db()
    .from("streaks")
    .upsert({
      user_id: run.user_id,
      current,
      longest: Math.max(current, s?.longest ?? 0),
      last_completed_date: day,
    })
    .throwOnError();
}

/** Today's contract, whether this player cleared it, and their streak. userId null = signed out. */
export async function getDaily(userId: string | null): Promise<DailyState> {
  const contract = await contractFor();
  if (!userId) return { contract, clearedToday: false, streak: { current: 0, longest: 0 } };

  const clearedToday = contract ? await clearedContract(userId, contract.id) : false;
  const { data: s } = await db().from("streaks").select("*").eq("user_id", userId).maybeSingle().throwOnError();
  // A streak is still alive if the last clear was today or yesterday.
  const today = dayOf();
  const alive = s && (s.last_completed_date === today || s.last_completed_date === previousDay(today));
  return { contract, clearedToday, streak: { current: alive ? s.current : 0, longest: s?.longest ?? 0 } };
}
