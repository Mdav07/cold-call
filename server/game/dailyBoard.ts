// The Daily Case board (88a8, .plans/daily.md): one case per UTC date, fastest confirmed breach per player.
// Rows come from the public leaderboard view, so every entry is a breach the chain confirmed.

import { db } from "@/server/chain/db";
import { getDemoUserId, isPublicBoardName } from "@/server/game/players";
import { DAILY_FLOOR, todayUtc } from "@/shared/dailyCase";
import { isSeasonalDate } from "@/shared/seasonalCase";

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
  const demoId = await getDemoUserId().catch(() => null);
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
    // Shared guest account isn't a player — keep "Demo Hunter" off the board.
    if (!r.user_id || r.user_id === demoId || !isPublicBoardName(r.display_name)) continue;
    if (seen.has(r.user_id)) continue;
    seen.add(r.user_id);
    rows.push({ name: r.display_name as string, ms: Number(r.duration_ms), channel: r.channel, tx: r.tx_hash });
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
    .eq("practice", false)
    .eq("outcome", "breach");
  return (count ?? 0) > 0;
}

export interface DailyStreak {
  current: number; // days in a row up to today (or yesterday, if today isn't done yet)
  best: number;
}

const prevDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** Days in a row this player cleared the Daily Case on its own day (practice replays don't count). */
export async function dailyStreak(userId: string, today: string = todayUtc()): Promise<DailyStreak> {
  if (!hasDb()) return { current: 0, best: 0 };
  const { data } = await db()
    .from("runs")
    .select("daily_date")
    .eq("user_id", userId)
    .eq("floor", DAILY_FLOOR)
    .eq("practice", false)
    .eq("outcome", "breach")
    .not("daily_date", "is", null);
  const days = new Set((data ?? []).map((r) => r.daily_date as string).filter((d) => !isSeasonalDate(d)));
  return streakOf(days, today);
}

/** Pure: the streak from a set of cleared days. */
export function streakOf(days: Set<string>, today: string): DailyStreak {
  let best = 0;
  for (const d of days) {
    if (days.has(prevDay(d))) continue; // not the start of a run of days
    let n = 0;
    for (let x = d; days.has(x); x = new Date(Date.parse(`${x}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) n++;
    best = Math.max(best, n);
  }
  let current = 0;
  let x = days.has(today) ? today : prevDay(today);
  while (days.has(x)) {
    current++;
    x = prevDay(x);
  }
  return { current, best };
}
