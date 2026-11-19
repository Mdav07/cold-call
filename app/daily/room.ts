// The Daily Case room: generated from the day's date, the same for everyone that day.
// Random size and shape (sometimes an L), a back wall with windows, boards and the elevator, random
// furniture, today's employee behind a counter or a desk, and the four clues on boards and furniture.
// The look comes from the case's theme (content/daily/themes.json): its floor, walls, board, station
// (the employee's counter, which also holds clues), seat and three decor pieces, by tile name
// (app/floor/maps/tiles.json). The four bank themes keep the floors' own furniture.
// Every layout is checked with a BFS (spawn → exit, the employee, every clue, every free tile); a layout
// that fails is thrown away and the next attempt uses a new seed.

import type { DailyCase } from "@/shared/dailyCase";
import { DAILY_EMPLOYEE, DAILY_FLOOR, DAILY_THEMES } from "@/shared/dailyCase";
import type { Facing, FloorMap } from "@/app/floor/types";
import tilesFile from "@/app/floor/maps/tiles.json";
import { SEASONAL_THEMES } from "@/shared/seasonalCase";

const TILES = tilesFile.tiles as Record<string, { index: number; kind: string }>;
const tile = (name: string): number => {
  const t = TILES[name];
  if (!t) throw new Error(`themes.json names a tile tiles.json doesn't have: ${name}`);
  return t.index;
};

/** One room's look. `station` and `notes` are tile choices (the banks mix their four counter tiles). */
interface Skin {
  bank: boolean;
  ground: number;
  top: number;
  face: number;
  window: number;
  board: number;
  station: readonly number[];
  notes: readonly number[];
  seat: number;
  decor: readonly number[];
  executive: boolean;
}

function skinFor(c: DailyCase): Skin {
  // An unknown theme (an old case, a typo) gets the Pocket Branch look rather than an error.
  const theme = [...DAILY_THEMES, ...SEASONAL_THEMES].find((t) => t.id === c.theme) ?? DAILY_THEMES.find((t) => t.id === "bank-branch") ?? DAILY_THEMES[0];
  const t = theme.tiles;
  const bank = theme.id.startsWith("bank-");
  return {
    bank,
    ground: tile(t.floor),
    top: tile(t.walltop),
    face: tile(t.wall),
    window: tile(t.window),
    board: tile(t.board),
    // The banks keep the floors' counter mix (plain, papers, books, files) and its three notes.
    station: bank ? T.counter : [tile(t.station)],
    notes: bank ? T.counterNotes : [tile(t.station_note)],
    seat: tile(t.seat),
    decor: t.decor.map(tile),
    executive: theme.id === "bank-executive",
  };
}

const T = {
  elevator: 16,
  desk: [17, 18, 19],
  tableOval: [20, 21],
  plant: 30,
  plantSmall: 31,
  counter: [32, 33, 34, 35],
  cabinet: 36,
  locker: 37,
  copier: 38,
  bookshelf: 39,
  cooler: 40,
  rugs: [
    [42, 43, 44],
    [45, 46, 47],
  ],
  paintings: [48, 49, 50],
  candelabra: 52,
  counterNotes: [58, 59, 60], // card, note, sign: a counter with something on it to read
} as const;

/** The prop id of one of the day's clues (also what the case file checks to show it as found). */
export const dailyPropId = (date: string, clueId: string) => `daily-${date}-${clueId}`;

/** mulberry32 from a string, so each date (and each retry) gives its own stable sequence. */
function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Cell = { x: number; y: number };
// Clues go on boards, counters, desks and shelves only: never a plant, a table or the water cooler.
type Kind = "counter" | "desk" | "shelf" | "other";
const HOLDS_CLUES: Kind[] = ["counter", "desk", "shelf"];
const DIRS: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];

/** One attempt at a room. Returns null if the layout breaks a rule (the caller reseeds). */
/** A second NPC to place in the room (the seasonal helper / live co-signer). */
export interface RoomExtra {
  id: string;
  sprite: string;
}

function attempt(c: DailyCase, seed: string, extra?: RoomExtra): FloorMap | null {
  const r = rng(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1)); // inclusive
  const pick = <U,>(a: readonly U[]): U => a[Math.floor(r() * a.length)];
  const shuffle = <U,>(a: U[]): U[] => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const skin = skinFor(c);
  const W = int(10, 16);
  const H = int(8, 12);
  const ground = new Array<number>(W * H).fill(-1);
  const walls = new Array<number>(W * H).fill(-1);
  const decor = new Array<number>(W * H).fill(-1);
  const blocked = new Set<number>();
  const idx = (x: number, y: number) => y * W + x;

  // Shell: wall tops all round, the back wall's face on row 1, floor inside (rows 2..H-2).
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (x === 0 || x === W - 1 || y === 0 || y === H - 1) walls[idx(x, y)] = skin.top;
      else if (y === 1) walls[idx(x, y)] = skin.face;
      else ground[idx(x, y)] = skin.ground;
    }

  // Sometimes an L: cut a block out of one bottom corner.
  const innerW = W - 2, innerH = H - 3;
  if (innerH >= 6 && innerW >= 9 && r() < 0.45) {
    const cw = int(3, innerW - 6), ch = int(2, innerH - 4);
    const left = r() < 0.5;
    for (let y = H - 1 - ch; y < H; y++)
      for (let dx = 0; dx <= cw; dx++) {
        const x = left ? dx : W - 1 - dx;
        walls[idx(x, y)] = skin.top;
        ground[idx(x, y)] = -1;
      }
  }
  const isFloor = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < W && y < H && ground[idx(x, y)] >= 0 && walls[idx(x, y)] < 0;

  // Back wall: the elevator (the exit), 1–2 boards, a few windows.
  const backXs = shuffle(Array.from({ length: innerW }, (_, i) => i + 1));
  const doorX = backXs.pop()!;
  // Boards / elevator sit on row 1; row 0 stays wall top (dark outside). Writing face onto row 0
  // made wall color bleed into the void — same bug the floor maps fixed via build_maps wall-kind tops.
  const raise = (x: number, tile: number) => {
    walls[idx(x, 1)] = tile;
    ground[idx(x, 1)] = skin.ground; // the door and boards are drawn over floor, as in the floors' maps
  };
  raise(doorX, T.elevator);
  const boards: Cell[] = [];
  const boardCount = int(1, 2);
  for (const x of [...backXs]) {
    if (boards.length >= boardCount) break;
    if (Math.abs(x - doorX) < 2) continue; // not beside the door, where you arrive
    raise(x, skin.board);
    boards.push({ x, y: 1 });
    backXs.splice(backXs.indexOf(x), 1);
  }
  for (const x of backXs) if (r() < 0.3) walls[idx(x, 1)] = skin.window;

  // The spawn is one tile beside the exit column: one step up from it must not ride you straight out.
  const spawnX = doorX + 1 <= W - 2 && (doorX - 1 < 1 || r() < 0.5) ? doorX + 1 : doorX - 1;
  const spawn = { x: spawnX, y: 3, facing: "down" as Facing };
  const exit = { x: doorX, y: 2 };
  // Kept clear: the exit, the spawn and the tile below it, the tile in front of each board.
  const reserved = new Set<number>([idx(exit.x, exit.y), idx(spawn.x, spawn.y), idx(spawn.x, spawn.y + 1), ...boards.map((b) => idx(b.x, 2))]);
  const free = (x: number, y: number) => isFloor(x, y) && !blocked.has(idx(x, y)) && !reserved.has(idx(x, y));

  // BFS from the spawn. The exit counts as a wall (stepping on it leaves the room), and so does the
  // employee once placed.
  let npc: Cell | null = null;
  const passable = (x: number, y: number) =>
    isFloor(x, y) && !blocked.has(idx(x, y)) && !(x === exit.x && y === exit.y) && !(npc && x === npc.x && y === npc.y);
  const reach = () => {
    const seen = new Set<number>([idx(spawn.x, spawn.y)]);
    const q: Cell[] = [spawn];
    while (q.length) {
      const { x, y } = q.shift()!;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!passable(nx, ny) || seen.has(idx(nx, ny))) continue;
        seen.add(idx(nx, ny));
        q.push({ x: nx, y: ny });
      }
    }
    return seen;
  };
  // Every open tile stays reachable: no sealed-off pockets.
  const connected = () => {
    const seen = reach();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (passable(x, y) && !seen.has(idx(x, y))) return false;
    return true;
  };

  const remove = (cells: Cell[]) => {
    for (const p of cells) {
      decor[idx(p.x, p.y)] = -1;
      blocked.delete(idx(p.x, p.y));
    }
  };
  /** Place a row of furniture if it fits and the room stays connected; returns its cells. */
  const place = (x: number, y: number, tiles: readonly number[], chair?: Cell) => {
    const cells = tiles.map((_, i) => ({ x: x + i, y }));
    if (!cells.every((p) => free(p.x, p.y))) return null;
    if (chair && !free(chair.x, chair.y)) return null;
    cells.forEach((p, i) => {
      decor[idx(p.x, p.y)] = tiles[i];
      blocked.add(idx(p.x, p.y));
    });
    if (!connected()) {
      remove(cells);
      return null;
    }
    if (chair) {
      // Chairs block the player. Skip the chair (keep the furniture) if it would wall something off.
      blocked.add(idx(chair.x, chair.y));
      if (connected()) {
        decor[idx(chair.x, chair.y)] = skin.seat;
        reserved.add(idx(chair.x, chair.y));
      } else blocked.delete(idx(chair.x, chair.y));
    }
    return cells;
  };

  // 1. The employee's station: a counter or a desk (a themed workplace: its station, 3 wide), with the
  // employee standing behind it.
  const surfaces: { cells: Cell[]; kind: Kind }[] = [];
  for (let tries = 0; tries < 30 && !npc; tries++) {
    const desk = skin.bank && r() < 0.4;
    const tiles = desk ? T.desk : Array.from({ length: skin.bank ? int(3, 5) : 3 }, () => pick(skin.station));
    const x = int(1, W - 1 - tiles.length);
    const y = int(5, H - 3);
    const ex = x + int(0, tiles.length - 1);
    // Not right by the door: the player should cross the room to them.
    if (!free(ex, y - 1) || Math.abs(ex - spawn.x) + Math.abs(y - 1 - spawn.y) < 4) continue;
    reserved.add(idx(ex, y - 1));
    const cells = place(x, y, tiles);
    if (!cells) {
      reserved.delete(idx(ex, y - 1));
      continue;
    }
    npc = { x: ex, y: y - 1 };
    if (!connected()) return null; // the employee walls something off
    if (desk) {
      decor[idx(ex, y - 1)] = skin.seat; // the employee's own chair (they sit on it; solid either way)
      blocked.add(idx(ex, y - 1));
    }
    surfaces.push({ cells, kind: desk ? "desk" : "counter" });
  }
  if (!npc) return null;
  const talk = npc;

  // 2. More furniture, wherever it fits.
  const area = innerW * innerH;
  const extras = int(Math.floor(area / 14) + 2, Math.min(12, Math.floor(area / 9) + 2));
  for (let k = 0, tries = 0; k < extras && tries < 150; tries++) {
    const roll = r();
    const x = int(1, W - 2), y = int(3, H - 2);
    let cells: Cell[] | null;
    let kind: Kind = "other";
    if (roll < 0.22) {
      cells = place(x, y, T.desk, { x: x + 1, y: y + 1 });
      kind = "desk";
    } else if (roll < (skin.bank ? 0.34 : 0.44)) {
      // (A themed workplace has no shelves to hold clues, so it gets more of its station.)
      cells = place(x, y, Array.from({ length: int(2, 3) }, () => pick(skin.station)));
      kind = "counter";
    } else if (roll < 0.52 && skin.bank) {
      // Shelves, cabinets and the copier stand against the back wall.
      const tile = pick([T.bookshelf, T.bookshelf, T.cabinet, T.locker, T.copier]);
      cells = place(x, 2, Array.from({ length: tile === T.copier ? 1 : int(1, 3) }, () => tile));
      if (tile !== T.copier) kind = "shelf";
    } else if (roll < 0.74) {
      cells = place(x, y, T.tableOval);
    } else if (roll < 0.84 && skin.executive) {
      cells = place(x, 2, [pick([T.candelabra, ...T.paintings])]);
    } else {
      // Plants and the water cooler (a themed workplace: its three decor pieces) stand against a wall,
      // never out in the middle of the floor. Each of these cells has a wall beside it.
      const [px, py] = pick([[x, 2], [x, H - 2], [1, y], [W - 2, y]]);
      cells = place(px, py, [skin.bank ? (r() < 0.3 ? T.cooler : pick([T.plant, T.plant, T.plantSmall])) : pick(skin.decor)]);
    }
    if (cells) {
      surfaces.push({ cells, kind });
      k++;
    }
  }
  // Plants (or the theme's decor) in a few of the room's corners.
  for (const [x, y] of shuffle([[1, 2], [W - 2, 2], [1, H - 2], [W - 2, H - 2]]).slice(0, int(1, 3)))
    place(x, y, [skin.bank ? T.plant : pick(skin.decor)]);
  // A rug on open floor (walkable decor).
  if (r() < 0.6) {
    const rug = pick(T.rugs);
    const x = int(1, W - 4), y = int(3, H - 2);
    if (rug.every((_, i) => free(x + i, y) && decor[idx(x + i, y)] < 0)) rug.forEach((t, i) => (decor[idx(x + i, y)] = t));
  }

  // 3. The clues: on the boards first, then one per piece of furniture.
  const seen = reach();
  const readable = (p: Cell) => DIRS.some(([dx, dy]) => seen.has(idx(p.x + dx, p.y + dy)));
  const spots: Cell[] = boards.filter(readable);
  for (const s of shuffle(surfaces.filter((s) => HOLDS_CLUES.includes(s.kind)))) {
    if (spots.length >= c.clues.length) break;
    // Not the tile right in front of the employee: their counter is theirs.
    const options = s.cells.filter((p) => readable(p) && !(p.x === talk.x && p.y === talk.y + 1));
    if (!options.length) continue;
    const p = pick(options);
    spots.push(p);
    if (s.kind === "counter") decor[idx(p.x, p.y)] = pick(skin.notes);
  }
  if (spots.length < c.clues.length) return null;
  // The employee can be talked to, and the way out is open.
  if (!readable(talk) || !readable(exit)) return null;

  // A second NPC (the seasonal helper): a free floor tile where, with them standing there, every
  // open tile, clue, the employee, the exit and the extra themselves are still reachable.
  let extraCell: Cell | null = null;
  if (extra) {
    // Not crowding the employee: at least three steps from them.
    const away = (k: number) => Math.abs((k % W) - talk.x) + Math.abs(Math.floor(k / W) - talk.y) >= 3;
    for (const k of shuffle([...seen]).filter(away)) {
      const p = { x: k % W, y: Math.floor(k / W) };
      if (!free(p.x, p.y) || (p.x === talk.x && p.y === talk.y)) continue;
      blocked.add(k);
      const ok = connected() && readable(talk) && readable(exit) && readable(p) && spots.every(readable);
      if (ok) {
        extraCell = p;
        break;
      }
      blocked.delete(k);
    }
    if (!extraCell) return null;
  }

  return {
    floor: DAILY_FLOOR as FloorMap["floor"],
    name: `Daily Case · ${c.title}`,
    width: W,
    height: H,
    tileset: "/tiles/plumpurse.png",
    tilesetColumns: 16,
    layers: { ground, walls, decor },
    blocked: [...blocked].sort((a, b) => a - b),
    spawn,
    npcs: [
      { id: DAILY_EMPLOYEE, x: talk.x, y: talk.y, facing: "down", sprite: c.employee.sprite },
      // Seasonal helper is a live employee (id "helper"); FloorGame starts a real chat.
      ...(extra && extraCell ? [{ id: extra.id as typeof DAILY_EMPLOYEE, x: extraCell.x, y: extraCell.y, facing: "down" as Facing, sprite: extra.sprite }] : []),
    ],
    // Prop ids carry the date: clue ids repeat every day, and yesterday's note mustn't count today.
    props: c.clues.map((clue, i) => ({ id: dailyPropId(c.date, clue.id), ...spots[i], label: clue.label, text: clue.text })),
    exits: [{ x: exit.x, y: exit.y, to: "/tower" }],
  };
}

export function buildDailyRoom(c: DailyCase, extra?: RoomExtra): FloorMap {
  for (let i = 0; i < 500; i++) {
    const m = attempt(c, i === 0 ? c.date : `${c.date}#${i}`, extra);
    if (m) return m;
  }
  throw new Error(`No Daily Case room could be laid out for ${c.date}`);
}
