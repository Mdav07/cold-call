import { connection } from "next/server";
import { signedInUserId } from "@/server/game/auth";
import { dailyCleared, dailyStreak } from "@/server/game/dailyBoard";
import { todayUtc } from "@/shared/dailyCase";

/**
 * GET /api/session/streak : the signed-in player's Daily Case streak, for the streak badge.
 * Guests get { guest: true }; their streak is kept in this browser (app/play/streak.ts), because
 * signed-out players share one demo account and its streak isn't theirs.
 */
export async function GET() {
  await connection();
  const userId = await signedInUserId();
  if (!userId) return Response.json({ guest: true });
  const today = todayUtc();
  const [streak, clearedToday] = await Promise.all([dailyStreak(userId, today), dailyCleared(userId, today)]);
  return Response.json({ guest: false, current: streak.current, best: streak.best, clearedToday });
}
