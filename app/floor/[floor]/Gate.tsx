// Floors open in order, as on /tower: a locked floor is covered by a "clear Floor N first" screen.
// This is the page only; /api/session still decides who may start a run.

import { loadTower } from "@/app/floor/hud/data";
import { LockedFloor } from "./LockedFloor";

export async function Gate({ floor }: { floor: number }) {
  const { floors } = await loadTower();
  const f = floors.find((x) => x.floor === floor);
  if (!f || f.unlocked) return null;
  const below = floor - 1;
  return <LockedFloor floor={floor} below={below === 0 ? "the Pocket Branch" : `Floor ${below}`} />;
}
