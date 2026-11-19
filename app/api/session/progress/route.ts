import { connection } from "next/server";
import { db } from "@/server/chain/db";
import { signedInUserId } from "@/server/game/auth";
import { dailyStreak } from "@/server/game/dailyBoard";
import { DAILY_FLOOR } from "@/shared/dailyCase";
import { SEASONS, isSeasonalDate } from "@/shared/seasonalCase";

/**
 * GET /api/session/progress : what the signed-in player has achieved, for hunter unlocks (app/play/unlocks.ts):
 * floors cleared, Daily Cases cleared (each day once, practice excluded) and their best Daily streak.
 * Guests get { guest: true }; their progress comes from this browser instead.
 */
export async function GET() {
  await connection();
  const userId = await signedInUserId();
  if (!userId) return Response.json({ guest: true });
  const [{ data: runs }, streak] = await Promise.all([
    db().from("runs").select("floor, daily_date, practice").eq("user_id", userId).eq("outcome", "breach"),
    dailyStreak(userId),
  ]);
  const floors = new Set<number>();
  const days = new Set<string>();
  const seasons = new Set<string>();
  for (const r of runs ?? []) {
    if (r.floor === DAILY_FLOOR) {
      if (isSeasonalDate(r.daily_date as string)) {
        const s = SEASONS.find((x) => x.caseDate === r.daily_date);
        if (s) seasons.add(s.id);
      } else if (!r.practice && r.daily_date) days.add(r.daily_date as string);
    } else floors.add(r.floor as number);
  }
  return Response.json({ guest: false, clearedFloors: [...floors].sort(), dailyClears: days.size, bestStreak: streak.best, seasonsCleared: [...seasons] });
}
