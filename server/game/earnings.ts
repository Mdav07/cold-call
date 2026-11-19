// A player's total bounty: the sum of what staff agreed to on every breach ("cracked"), or what the
// chain paid where that isn't recorded. The same rule as the leaderboard's Top earners, so the numbers
// on the HUD, the breach screen and the board always agree. Amounts in 6-decimal USDC units.

import { db } from "@/server/chain/db";

export async function earnedUnits(userId: string): Promise<number> {
  const q = (cols: string) => db().from("runs").select(cols).eq("user_id", userId).eq("outcome", "breach").not("payout_units", "is", null).limit(5000);
  const withCracked = await q("payout_units, cracked_units");
  const { data } = withCracked.error ? await q("payout_units") : withCracked;
  let units = 0;
  for (const r of (data ?? []) as unknown as { payout_units: string | number | null; cracked_units?: string | number | null }[])
    units += Number(r.cracked_units ?? r.payout_units ?? 0);
  return units;
}
