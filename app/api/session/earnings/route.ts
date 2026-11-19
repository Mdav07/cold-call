import { connection } from "next/server";
import { signedInUserId } from "@/server/game/auth";
import { earnedUnits } from "@/server/game/earnings";

/** GET /api/session/earnings : the signed-in player's total bounty ({ units }), or { guest: true }. */
export async function GET() {
  await connection();
  const userId = await signedInUserId();
  if (!userId) return Response.json({ guest: true });
  return Response.json({ guest: false, units: await earnedUnits(userId) });
}
