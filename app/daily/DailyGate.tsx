// The Daily Case opens once the tutorial is cleared: for a signed-in player, a Tutorial breach on
// their account; for a guest, this browser's own clear (guests share the demo player's history).
// This is the page only; /api/session still decides who may start a daily run.

import { loadTower } from "@/app/floor/hud/data";
import { signedInUserId } from "@/server/game/auth";
import { LockedFloor } from "@/app/floor/[floor]/LockedFloor";
import { DailyGuestGate, LOCKED_BODY, LOCKED_TITLE } from "./DailyGuestGate";

export async function DailyGate() {
  const signedIn = await signedInUserId().catch(() => null);
  if (!signedIn) return <DailyGuestGate />;
  const { floors } = await loadTower();
  const tutorial = floors.find((f) => f.floor === 0);
  // No tower data (DB hiccup): don't lock the player out of today's case.
  if (!tutorial || tutorial.cleared) return null;
  return <LockedFloor floor={4} below="the Tutorial" title={LOCKED_TITLE} body={LOCKED_BODY} />;
}
