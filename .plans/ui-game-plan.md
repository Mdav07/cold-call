# Walkable floors: UI plan (Nov 17)

Madhav's decision: the game becomes a top-down pixel RPG in the style of cozy 2D games. You walk your
character around a floor of Plumpurse Savings & Trust, walk up to an employee, press a key, and a
dialogue box opens at the bottom of the screen with choices. The conversation itself is the existing
ElevenLabs agent (chat or voice), unchanged. Deadline: Fri Nov 20, 11:00 AM CST; feature freeze Thu 11 PM.

Use the reference games only for the feel (top-down view, tiles, bottom dialogue box with a name plate
and a choice cursor). Do not copy their art, characters, fonts, music or layouts.

## Decisions

| Topic | Decision |
| --- | --- |
| Engine | HTML canvas + React. A small custom tile renderer; no game framework. Dialogue, HUD and overlays are React on top of the canvas. |
| Dialogue | Bottom box with a name plate, typewriter text and a choice cursor: **Talk** (type), **Call** (voice), **Case file**, **Leave**. Talk opens a text field inside the box. |
| Art | A CC0 tileset and character sprites (check each licence; credit it in the README) combined with Audrey's pixel portraits (`app/play/portraits/`) for the dialogue box. |
| Route | New route `/floor/[floor]` (0 to 3). `/play/[employee]` stays as the fallback until the new view works on production. |
| Work split | A (Madhav's agent 88a8): engine. A2 (Madhav's new agent 6b5c): dialogue and wiring. B (Audrey's agents): maps, art, rules. |

## Owners (exception to CLAUDE.md, agreed for this feature)

| Path | Owner | What |
| --- | --- | --- |
| `app/floor/engine/` | A (88a8) | Canvas renderer, map loader, movement, collision, camera, interaction detection, touch controls |
| `app/floor/dialogue/`, `app/floor/hud/`, `app/floor/[floor]/page.tsx` | A2 (6b5c) | Dialogue box, choices, chat/voice wiring, HUD, the page that composes everything |
| `app/floor/maps/`, `public/sprites/`, `public/tiles/` | B (Audrey's agents) | Floor maps (JSON), tileset, player and NPC sprite sheets, credits |
| `app/play/*` hooks and components | B | Reused unchanged by A2 (`useEmployeeChat`, `useRunState`, `OutcomeOverlay`, `KrystalMemo`, portraits). Ask B for changes. |
| `app/tower/page.tsx` | B | Links each floor to `/floor/<n>` when the new view is ready |

Each owner works on a branch off `main` (`ui/engine`, `ui/dialogue`, `ui/maps`) and tells A (88a8)
the commit to merge and deploy. Run `npm run build` before every push.

## Contract between the pieces

Put these types in `app/floor/types.ts` (A writes it first; changes by agreement between A, A2 and B).

```ts
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
}
```

## Tasks

### A (88a8): engine (`app/floor/engine/`)
1. `app/floor/types.ts` with the contract above; a placeholder map for Floor 1 (coloured tiles, two NPCs) so A2 can start at once.
2. `<FloorScene>`: canvas sized to the viewport, crisp pixel scaling, `requestAnimationFrame` loop.
3. Grid movement with smooth steps (arrow keys and WASD), 4-direction walking animation, collision with walls, blocked cells and NPCs.
4. Camera that follows the player and clamps to the map edges.
5. Interaction: Space, Enter or E while facing an adjacent NPC or prop sends `interact-*`; stepping on an exit sends `exit`. A small "!"/speech-bubble prompt above the NPC you are facing.
6. NPCs face the player when you talk to them; idle NPCs turn now and then.
7. Touch controls for phones: an on-screen D-pad and an A button.
8. `prefers-reduced-motion`: no camera smoothing.

### A2 (6b5c): dialogue, HUD and the page
1. `app/floor/[floor]/page.tsx` (Next 16, `cacheComponents` is on: dynamic data inside `<Suspense>`, `params` is a Promise). Loads the map and composes `<FloorScene>`, `<DialogueBox>`, `<Hud>`, `OutcomeOverlay`.
2. `<DialogueBox>` at the bottom: name plate, portrait (Audrey's `PORTRAITS[id]` with a `mood` from the suspicion level), typewriter text (skip on keypress), choice cursor moved with arrows and confirmed with Space or Enter.
3. Choices: **Talk** opens a text field in the box and runs the existing `useEmployeeChat(employeeId)` chat; **Call** starts the voice session through the same hook; **Case file** opens `/casefile` in a panel or new tab; **Leave** ends the conversation and gives movement back.
4. Show the agent's replies in the box (newest line, with a scroll-back of earlier lines), the suspicion meter, and the proposal panel (reuse the pieces from `app/play/ChatRoom.tsx`; ask B to export them if they are not exported).
5. `<Hud>` (top corner): floor name, run timer, vault balance, Daily Contract badge.
6. Run state: `useRunState` polling; on breach or lockout show `OutcomeOverlay`; locked-out employees show an alarm emote and refuse to talk.
7. Prop and sign text uses the same box without choices.

### B (Audrey's agents): maps, art, rules
1. Pick a CC0 16x16 interior tileset and character sprite sheets (check the licence; record it in the README credits). Put them in `public/tiles/` and `public/sprites/` in the sprite format above.
2. Maps for Floors 0 to 3 in `app/floor/maps/floor-<n>.json` (the Pocket Branch, the bullpen, management offices, executive suite), each with the employees placed at their desks, a few props that carry clues (memos, the vendor registry, a calendar), and an exit to the tower.
3. Link `/tower` floors to `/floor/<n>` when it works; keep the unlock order.
4. Check the game rules still hold in the new view: talk time, run limits, suspicion, memory, Floor 3 call-backs.

## Order and checkpoints
- Today: A ships the types file and a placeholder Floor 1 map; A2 builds the dialogue box against it; B picks the art.
- Wed midday: Floor 1 playable end to end on production (walk, talk, breach).
- Wed night: all four floors with real art.
- Thu: polish, demo video. Thu 11 PM feature freeze.
