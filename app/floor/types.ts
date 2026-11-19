// Contract between the floor engine (A), the dialogue/page (A2) and the maps/art (B).
// See .plans/ui-game-plan.md. Change only by agreement between the three.
import type { EmployeeId } from "@/shared/interfaces";

export type Facing = "up" | "down" | "left" | "right";

/** One floor. Tile size is 16 px, drawn at a shared integer scale from the viewport (not fit-to-map). */
export interface FloorMap {
  floor: 0 | 1 | 2 | 3 | 4; // 4 = the Daily Case (/daily)
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
  exits?: { x: number; y: number; to: "/tower" | `/floor/${number}` | "/daily" }[];
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
  /** Door / guide labels (e.g. "TUTORIAL") — nameplate style, centred on the tile (or `endAt: "x"`). */
  /** Text labels on the map. `mat`: printed on a doormat (no plate, always shown). */
  /** `always`: shown at any distance (e.g. a LOCKED sign on a door); otherwise a tag fades in near the player. */
  /** `fit`: keep the plate within that many tiles wide (its text shrinks when the room is drawn small). */
  tags?: { x: number; y: number; text: string; endAt?: "x"; mat?: boolean; always?: boolean; fit?: number }[];
  /** Labels drawn above heads: NPC id -> name, plus "player" for the player's name. */
  names?: Partial<Record<string, string>>;
  /**
   * The escort cutscene (an employee hit 100% suspicion): a security guard walks in from the door, stands
   * over the player, walks them back to the door and the screen fades to black, then onDone runs once.
   * A new key starts it again; null ends it and lifts the fade.
   */
  escort?: { key: string; onDone: () => void } | null;
  /** Phones held upright show the room as a handheld console: the map is the screen and the controls sit
   *  on a deck below it. Whatever is passed here (the HUD bar) is docked on that deck. */
  deck?: import("react").ReactNode;
}
