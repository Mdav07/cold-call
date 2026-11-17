// The Daily Case board (88a8, .plans/daily.md): one case per UTC date, fastest confirmed breach per player.
// Rows come from the public leaderboard view, so every entry is a breach the chain confirmed.

import { db } from "@/server/chain/db";
import { DAILY_FLOOR, todayUtc } from "@/shared/dailyCase";

export interface DailyBoardRow {
  name: string;
  ms: number;
  channel: string;
  tx: string;
}

const hasDb = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

/** Fastest clear per player of the case for `date` (default: today, UTC), fastest first. */
export async function dailyBoard(date: string = todayUtc(), limit = 20): Promise<DailyBoardRow[]> {
  if (!hasDb()) return [];
  const { data } = await db()
    .from("leaderboard")
    .select("user_id, display_name, duration_ms, channel, tx_hash")
    .eq("floor", DAILY_FLOOR)
    .eq("daily_date", date)
    .not("duration_ms", "is", null)
    .order("duration_ms")
    .limit(200);
  const seen = new Set<string>();
  const rows: DailyBoardRow[] = [];
  for (const r of data ?? []) {
    if (seen.has(r.user_id)) continue;
    seen.add(r.user_id);
    rows.push({ name: r.display_name ?? "Anonymous hunter", ms: Number(r.duration_ms), channel: r.channel, tx: r.tx_hash });
    if (rows.length >= limit) break;
  }
  return rows;
}

/** Whether this player has a confirmed clear of the case for `date`. */
export async function dailyCleared(userId: string, date: string = todayUtc()): Promise<boolean> {
  if (!hasDb()) return false;
  const { count } = await db()
    .from("runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("floor", DAILY_FLOOR)
    .eq("daily_date", date)
    .eq("outcome", "breach");
  return (count ?? 0) > 0;
}
