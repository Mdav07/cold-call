// Contract between the floor engine (A), the dialogue/page (A2) and the maps/art (B).
// See .plans/ui-game-plan.md. Change only by agreement between the three.
import type { EmployeeId } from "@/shared/interfaces";

export type Facing = "up" | "down" | "left" | "right";

/** One floor. Tile size is 16 px, drawn at an integer scale (3x on desktop). */
export interface FloorMap {
  floor: 0 | 1 | 2 | 3;
  name: string;                 // shown in the HUD
  width: number;                // in tiles
  height: number;
  tileset: string;              // URL under /tiles/, a PNG grid of 16x16 tiles
  tilesetColumns: number;
  layers: {
    ground: number[];           // width*height tile indexes, -1 = empty
    walls: number[];            // drawn above ground; any tile >= 0 blocks movement
    decor: number[];            // drawn above walls; does not block
    overhead?: number[];        // drawn above characters (tops of plants, ceiling lights)
  };
  blocked?: number[];           // extra blocking cells (indexes), for furniture on the decor layer
  spawn: { x: number; y: number; facing: Facing };
  npcs: { id: EmployeeId; x: number; y: number; facing: Facing; sprite: string }[];
  /** Things to read: a sign, a memo on a desk, the vendor registry. Opens the dialogue box with text only. */
  props?: { id: string; x: number; y: number; label: string; text: string }[];
  exits?: { x: number; y: number; to: "/tower" | `/floor/${number}` }[];
}

/** Sprite sheet: 4 rows (down, left, right, up) x 4 walking frames, 16x32 px per frame. */
export interface SpriteSheet { url: string; frameWidth: 16; frameHeight: 32 }

/** What the engine tells the page. */
export type SceneEvent =
  | { type: "interact-npc"; id: EmployeeId }
  | { type: "interact-prop"; id: string }
  | { type: "exit"; to: string };

export interface FloorSceneProps {
  map: FloorMap;
  playerSprite: string;
  /** While true, movement keys are ignored (the dialogue box has focus). */
  paused: boolean;
  onEvent: (e: SceneEvent) => void;
  /** NPC emotes drawn above heads, e.g. "!" when suspicious or a speech bubble while talking. */
  emotes?: Partial<Record<EmployeeId, "talking" | "suspicious" | "alarm" | null>>;
  /** CSS pixels at the bottom covered by UI (the dialogue box). The camera keeps the player above it. */
  insetBottom?: number;
  /** Where the player should go next: a faint trail of dots leads there. Null hides it. */
  goal?: { x: number; y: number } | null;
  /** Small text tags drawn on the map, e.g. "TUTORIAL" over a door. */
  tags?: { x: number; y: number; text: string }[];
  /** Labels drawn above heads: NPC id -> name, plus "player" for the player's name. */
  names?: Partial<Record<string, string>>;
}
