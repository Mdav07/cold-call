import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/chain/db";
import { isStubMode } from "@/server/game/session";
import { currentLevel, LOCKOUT, STARTING_SUSPICION } from "@/server/game/suspicion";
import type { EmployeeId } from "@/shared/interfaces";
import { dailyStreak } from "@/server/game/dailyBoard";
import { DAILY_FLOOR } from "@/shared/dailyCase";

const Query = z.object({
  run_id: z.uuid(),
  employee_id: z.enum(["barry", "penny", "dee", "annie", "bill", "cassius", "max", "daily"]),
});

/**
 * GET /api/session/state?run_id=&employee_id= : what the chat screen shows live (meter, last
 * reason, proposal, run outcome). Polled by the UI until players sign in, after which Supabase
 * Realtime (which needs auth.uid() for row level security) replaces it.
 */
export async function GET(req: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const { run_id, employee_id } = parsed.data;
  const employee = employee_id as EmployeeId;

  if (isStubMode()) {
    return Response.json({ level: STARTING_SUSPICION[employee], locked_out: false, reason: null, proposal: null, run: null });
  }

  const [level, last, proposal, run] = await Promise.all([
    currentLevel(run_id, employee),
    db()
      .from("suspicion_events")
      .select("delta, reason")
      .eq("run_id", run_id)
      .eq("employee_id", employee)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db()
      .from("proposals")
      .select("kind, status, amount_units, claimed_name, unlock_at")
      .eq("run_id", run_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db()
      .from("runs")
      .select("user_id, floor, outcome, tx_hash, ended_at, duration_ms, payout_units, daily_date, practice")
      .eq("id", run_id)
      .maybeSingle(),
  ]);

  // The Daily Case: the player's streak (practice replays don't count), for the result screen.
  const { user_id, ...runRow } = run.data ?? { user_id: null };
  const daily_streak = run.data?.floor === DAILY_FLOOR && user_id ? await dailyStreak(user_id) : null;

  return Response.json({
    level,
    locked_out: level >= LOCKOUT,
    reason: last.data ? { delta: last.data.delta, text: last.data.reason } : null,
    proposal: proposal.data ?? null,
    run: run.data ? runRow : null,
    daily_streak,
  });
}
