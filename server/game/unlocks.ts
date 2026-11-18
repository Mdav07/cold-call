// Which floors this request's player has unlocked. Signed in: their account's clears (loadTower).
// Guests share one demo player, so their floors come from this browser's own clears, mirrored into the
// "cc-cleared" cookie by app/floor/guestProgress.ts (the same thing the lobby trusts from localStorage).

import { cookies } from "next/headers";
import { loadTower } from "@/app/floor/hud/data";
import { signedInUserId } from "./auth";

export const CLEARED_COOKIE = "cc-cleared";

export async function unlockedFloorsForRequest(): Promise<number[]> {
  if (await signedInUserId()) {
    const { floors } = await loadTower();
    return floors.filter((f) => f.unlocked).map((f) => f.floor);
  }
  const mask = (await cookies()).get(CLEARED_COOKIE)?.value ?? "";
  return [0, 1, 2, 3].filter((f) => f === 0 || mask[f - 1] === "1");
}
