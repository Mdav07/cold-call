// The Daily Case room: a small room built from the day's case, the same for everyone.
// It reuses the Pocket Branch layout (one counter, one employee, notes on the walls and the counter)
// and reskins it with one of the four floors' tile sets, picked by the date, so each day looks different.

import type { DailyCase } from "@/shared/dailyCase";
import { DAILY_EMPLOYEE, DAILY_FLOOR } from "@/shared/dailyCase";
import type { FloorMap } from "@/app/floor/types";
import pocket from "@/app/floor/maps/floor-0.json";

/** The tile set of each floor: ground, wall top, wall face, window, board. Door (16) is shared. */
const SKINS = [
  { ground: 0, top: 3, face: 1, window: 2, board: 54 }, // Pocket Branch: warm wood
  { ground: 4, top: 7, face: 5, window: 6, board: 55 }, // Bullpen: office carpet
  { ground: 8, top: 11, face: 9, window: 10, board: 56 }, // Management
  { ground: 12, top: 15, face: 13, window: 14, board: 57 }, // Executive suite
] as const;
const BASE = SKINS[0];

/** A seeded number from the date, so the room is stable for the day. */
function seedOf(date: string): number {
  let h = 2166136261;
  for (let i = 0; i < date.length; i++) h = Math.imul(h ^ date.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Spots for the four clues: two notice boards on the back wall and three places on the counter. */
const CLUE_SPOTS = [
  { x: 2, y: 1 },
  { x: 4, y: 1 },
  { x: 4, y: 6 },
  { x: 6, y: 6 },
  { x: 7, y: 6 },
];

/** The prop id of one of the day's clues (also what the case file checks to show it as found). */
export const dailyPropId = (date: string, clueId: string) => `daily-${date}-${clueId}`;

export function buildDailyRoom(c: DailyCase): FloorMap {
  const base = pocket as unknown as FloorMap;
  const seed = seedOf(c.date);
  const skin = SKINS[seed % SKINS.length];
  const swap = (t: number, from: Record<string, number>, to: Record<string, number>) => {
    for (const k of Object.keys(from)) if (from[k] === t) return to[k];
    return t;
  };

  // Rotate the clue spots by the seed, then place the case's clues (already shuffled by the case).
  // Prop ids carry the date: clue ids repeat every day, and reading yesterday's note mustn't count today.
  const start = (seed >>> 3) % CLUE_SPOTS.length;
  const spots = CLUE_SPOTS.map((_, i) => CLUE_SPOTS[(start + i) % CLUE_SPOTS.length]);
  const props = c.clues.map((clue, i) => ({ id: dailyPropId(c.date, clue.id), x: spots[i].x, y: spots[i].y, label: clue.label, text: clue.text }));

  // Barry's spot behind the counter becomes today's employee.
  const desk = base.npcs[0] ?? { x: 5, y: 5, facing: "down" as const };

  return {
    ...base,
    floor: DAILY_FLOOR as FloorMap["floor"],
    name: `Daily Case · ${c.title}`,
    layers: {
      ...base.layers,
      ground: base.layers.ground.map((t) => swap(t, BASE, skin)),
      walls: base.layers.walls.map((t) => swap(t, BASE, skin)),
    },
    npcs: [{ id: DAILY_EMPLOYEE, x: desk.x, y: desk.y, facing: "down", sprite: c.employee.sprite }],
    props,
  };
}
