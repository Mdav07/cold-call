// Floors open in order, as on /tower: a locked floor is covered by a "clear Floor N first" screen.
// This is the page only; /api/session still decides who may start a run.

import { loadTower } from "@/app/floor/hud/data";
import { signedInUserId } from "@/server/game/auth";
import { LockedFloor } from "./LockedFloor";
import { GuestGate } from "./GuestGate";

export async function Gate({ floor }: { floor: number }) {
  const below = floor - 1 === 0 ? "the Tutorial" : `Floor ${floor - 1}`;
  // Guests share the demo player's clears, so their gate is this browser's own progress.
  const signedIn = await signedInUserId().catch(() => null);
  if (!signedIn) return <GuestGate floor={floor} below={below} />;
  const { floors } = await loadTower();
  const f = floors.find((x) => x.floor === floor);
  if (!f || f.unlocked) return null;
  return <LockedFloor floor={floor} below={below} />;
}
