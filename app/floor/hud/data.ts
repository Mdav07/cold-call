// The tower data a floor page needs (unlock flags, vault balances, the Daily Contract), loaded
// once per request and shared by the HUD and the unlock gate. Request-time only.

import { cache } from "react";
import { connection } from "next/server";
import { signedInUserId } from "@/server/game/auth";
import { getDemoUserId } from "@/server/game/players";
import { getTower, type TowerFloor } from "@/server/game/tower";
import { getDaily, type DailyState } from "@/server/game/daily";

export const loadTower = cache(async (): Promise<{ floors: TowerFloor[]; daily: DailyState | null }> => {
  // The Daily Contract reads today's date and the balances are live: never prerender this.
  await connection();
  // Each part fails on its own: no database still gives the unlock flags and balances, and no
  // data at all leaves the HUD showing "?" and every floor open rather than failing the page.
  const userId = await (async () => {
    try {
      return (await signedInUserId()) ?? (process.env.SUPABASE_SERVICE_ROLE_KEY ? await getDemoUserId() : null);
    } catch {
      return null;
    }
  })();
  const [floors, daily] = await Promise.all([
    getTower(userId).catch(() => [] as TowerFloor[]),
    getDaily(userId).catch(() => null),
  ]);
  return { floors, daily };
});
