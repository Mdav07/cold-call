// The tower lobby as a walkable map: elevators to Floors 1–3 on the back wall, the street door to the
// Pocket Branch (the tutorial) at the front, a reception desk and signs to read. Built in code from the
// shared tileset so it follows the player's progress: a locked floor's elevator has no exit, only a sign.
import type { FloorMap } from "@/app/floor/types";
import type { TowerFloor } from "@/server/game/tower";

const W = 19;
const H = 13;
// Tile indexes in /tiles/plumpurse.png (app/floor/maps/tiles.json).
const T = {
  floor: 12, wall: 13, window: 14, walltop: 15, elevator: 16,
  counter: 32, counterPapers: 33, counterFiles: 35, plant: 30, plantSmall: 31,
  painting: 49, bookshelf: 39, water: 40,
  chairDown: 24, tableRound: 23, chairLeft: 26, chairRight: 27, candelabra: 52,
} as const;

const ELEVATORS: Record<1 | 2 | 3, number> = { 1: 4, 2: 9, 3: 14 }; // x of each elevator door
const DOOR_X = 9; // street door in the front wall

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function buildLobby(floors: TowerFloor[], daily: string | null): FloorMap {
  const ground = Array<number>(W * H).fill(-1);
  const walls = Array<number>(W * H).fill(-1);
  const decor = Array<number>(W * H).fill(-1);
  const blocked: number[] = [];
  const at = (x: number, y: number) => y * W + x;

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const edge = x === 0 || x === W - 1 || y === 0 || y === H - 1;
      if (edge) walls[at(x, y)] = T.walltop;
      else if (y === 1) walls[at(x, y)] = x % 3 === 1 ? T.window : T.wall;
      else ground[at(x, y)] = T.floor;
    }

  // Back wall: three elevators, each with the floor-plate floor tile in front.
  for (const x of Object.values(ELEVATORS)) {
    walls[at(x, 1)] = T.elevator;
    ground[at(x, 0)] = T.floor;
  }
  // Front wall: the street door (an opening in the wall).
  walls[at(DOOR_X, H - 1)] = -1;
  ground[at(DOOR_X, H - 1)] = T.floor;

  const put = (x: number, y: number, tile: number, solid = true) => {
    decor[at(x, y)] = tile;
    if (solid) blocked.push(at(x, y));
  };
  // Reception desk across the middle with a gap to walk around on each side.
  for (let x = 7; x <= 11; x++) put(x, 6, x === 9 ? T.counterPapers : x === 11 ? T.counterFiles : T.counter);
  // Plants, a waiting area and a bookshelf so it reads as a bank lobby.
  for (const [x, y] of [[1, 2], [17, 2], [1, 11], [17, 11]] as const) put(x, y, T.plant);
  put(2, 9, T.tableRound);
  put(2, 8, T.chairDown);
  put(16, 9, T.water);
  put(15, 2, T.bookshelf);
  put(3, 2, T.plantSmall);
  // Portraits and candelabras on the back wall between the elevators (decor over the wall, not blocking).
  for (const x of [7, 11]) put(x, 1, T.painting, false);
  for (const x of [2, 16]) put(x, 1, T.candelabra, false);
  // Benches for visitors along the side walls, and plants by the desk.
  for (const y of [4, 5]) { put(1, y, T.chairRight); put(17, y, T.chairLeft); }
  put(6, 6, T.plantSmall);
  put(12, 6, T.plantSmall);
  put(13, 11, T.plant);
  put(5, 11, T.plant);

  const byFloor = (n: number) => floors.find((f) => f.floor === n);
  const exits: NonNullable<FloorMap["exits"]> = [{ x: DOOR_X, y: H - 1, to: "/floor/0" }];
  const props: NonNullable<FloorMap["props"]> = [];

  for (const [key, x] of Object.entries(ELEVATORS)) {
    const n = Number(key) as 1 | 2 | 3;
    const f = byFloor(n);
    const below = n - 1 === 0 ? "the Pocket Branch across the street" : `Floor ${n - 1}`;
    const best = f?.bestMs != null ? ` Your best: ${clock(f.bestMs)}.` : "";
    const people = f?.employees.map((e) => `${e.name} (${e.title})`).join(", ");
    const status = !f ? "" : f.cleared ? "CLEARED" : f.unlocked ? "OPEN" : "LOCKED";
    // A sign on the wall beside each elevator: read it by facing the wall next to the doors.
    props.push({
      id: `sign-${n}`,
      x: x + 1,
      y: 1,
      label: `Floor ${n} · ${f?.name ?? ""} · ${status}`,
      text: f?.unlocked
        ? `${f.description} Staff: ${people}.${best} Step into the elevator to go up.`
        : `Locked. Clear ${below} first. Staff: ${people ?? "unknown"}.`,
    });
    if (f?.unlocked) exits.push({ x, y: 2, to: `/floor/${n}` });
    else blocked.push(at(x, 2)); // a locked elevator: you can't stand in its doorway
  }

  const p0 = byFloor(0);
  props.push({
    id: "street-sign",
    x: DOOR_X + 2,
    y: H - 1,
    label: `Across the street · ${p0?.name ?? "Pocket Branch"}${p0?.cleared ? " · CLEARED" : ""}`,
    text: "The tutorial: Barry is closing up the Pocket Branch. Walk out through the door to try your first con.",
  });
  props.push({
    id: "reception",
    x: 9,
    y: 6,
    label: "Reception: tower directory",
    text: "Plumpurse Savings & Trust. Floor 1 The Bullpen, Floor 2 Operations, Floor 3 the Executive Suite. Each floor's vault is stricter than the one below. Clear a floor to unlock the next elevator.",
  });
  props.push({
    id: "daily-board",
    x: 2,
    y: 9,
    label: "Daily Contract board",
    text: daily ?? "No contract posted today.",
  });
  const top = floors
    .flatMap((f) => f.board.slice(0, 1).map((b) => `Floor ${f.floor}: ${b.name} ${clock(b.ms)}`))
    .join(" · ");
  props.push({
    id: "leaderboard-plaque",
    x: 16,
    y: 9,
    label: "Fastest heists",
    text: top ? `${top}. Full board at /leaderboard.` : "No breaches yet. Be the first.",
  });

  return {
    floor: 0,
    name: "Lobby · Plumpurse Tower",
    width: W,
    height: H,
    tileset: "/tiles/plumpurse.png",
    tilesetColumns: 16,
    layers: { ground, walls, decor },
    blocked,
    spawn: { x: DOOR_X, y: H - 3, facing: "up" },
    npcs: [],
    props,
    exits,
  };
}
