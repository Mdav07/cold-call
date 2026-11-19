// The tower lobby as a walkable map: five elevators on the back wall (Tutorial, Floors 1–3, Daily Case),
// each with a name plate on its door and a mat in front, a reception desk and signs to read. Built in
// code from the shared tileset so it follows the player's progress: a locked elevator has no exit.
import type { FloorMap } from "@/app/floor/types";
import type { TowerFloor } from "@/server/game/tower";
import { dailyCase, todayUtc } from "@/shared/dailyCase";

const W = 19;
const H = 13;
// Tile indexes in /tiles/plumpurse.png (app/floor/maps/tiles.json).
const T = {
  floor: 12, wall: 13, window: 14, walltop: 15, elevator: 16,
  counter: 32, counterPapers: 33, counterFiles: 35, plant: 30, plantSmall: 31,
  painting: 49, bookshelf: 39, water: 40,
  chairDown: 24, tableRound: 23, chairLeft: 26, chairRight: 27, candelabra: 52,
  // Elevator mats: gold-framed runners (tools/art/elegant_mats.py).
  matTutorial: 61, matDaily: 62, mat1: 63, mat2: 64, mat3: 65,
} as const;

export const ELEVATORS: Record<1 | 2 | 3, number> = { 1: 6, 2: 9, 3: 12 }; // x of each floor's elevator
export const TUTORIAL_X = 3; // the Tutorial's elevator (it goes across the street to the little branch)
export const DAILY_X = 15; // the Daily Case elevator (open once the Tutorial is cleared)
const MID_X = 9;

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Where to stand when you come back to the lobby from a level (RESTART sends you to /tower?at=…):
 * in front of that level's elevator, facing it.
 */
export function entranceSpawn(at: string | null | undefined): FloorMap["spawn"] | null {
  if (at === "floor-0") return { x: TUTORIAL_X, y: 3, facing: "up" };
  if (at === "daily") return { x: DAILY_X, y: 3, facing: "up" };
  const n = Number(at?.match(/^floor-([123])$/)?.[1]);
  return n ? { x: ELEVATORS[n as 1 | 2 | 3], y: 3, facing: "up" } : null;
}

/** The elevator sign for Floor n: its status and what it says. Guests' lobby redoes it from this browser's clears. */
export function elevatorSign(f: TowerFloor | undefined, n: number, open: boolean, cleared: boolean): { label: string; text: string } {
  const below = n - 1 === 0 ? "the Tutorial" : `Floor ${n - 1}`;
  const best = f?.bestMs != null ? ` Your best: ${clock(f.bestMs)}.` : "";
  const people = f?.employees.map((e) => `${e.name} (${e.title})`).join(", ");
  const status = cleared ? "CLEARED" : open ? "OPEN" : "LOCKED";
  return {
    label: `Floor ${n} · ${f?.name ?? ""} · ${status}`,
    text: open
      ? `${f?.description ?? ""} Staff: ${people}.${best} Step into the elevator to go up.`
      : `Locked. Clear ${below} first. Staff: ${people ?? "unknown"}.`,
  };
}

export function buildLobby(floors: TowerFloor[], entrance?: string | null): FloorMap {
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

  // Back wall: five elevators, each with its mat on the tile in front (y=2), which is the exit.
  for (const [x, mat] of [
    [TUTORIAL_X, T.matTutorial],
    [ELEVATORS[1], T.mat1],
    [ELEVATORS[2], T.mat2],
    [ELEVATORS[3], T.mat3],
    [DAILY_X, T.matDaily],
  ] as const) {
    walls[at(x, 1)] = T.elevator;
    ground[at(x, 0)] = T.floor;
    ground[at(x, 2)] = mat;
  }

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
  // Candelabras on the back wall at the ends (decor over the wall, not blocking).
  for (const x of [1, 17]) put(x, 1, T.candelabra, false);
  // Benches for visitors along the side walls, and plants by the desk.
  for (const y of [4, 5]) { put(1, y, T.chairRight); put(17, y, T.chairLeft); }
  put(6, 6, T.plantSmall);
  put(12, 6, T.plantSmall);
  put(13, 11, T.plant);
  put(5, 11, T.plant);

  const byFloor = (n: number) => floors.find((f) => f.floor === n);
  const exits: NonNullable<FloorMap["exits"]> = [{ x: TUTORIAL_X, y: 2, to: "/floor/0" }];
  const props: NonNullable<FloorMap["props"]> = [];

  for (const [key, x] of Object.entries(ELEVATORS)) {
    const n = Number(key) as 1 | 2 | 3;
    const f = byFloor(n);
    // Readable prop on the numbered mat (y=2): stand on / face the sparkles to learn what's upstairs.
    // Locked floors omit the exit so you can read but can't ride.
    props.push({ id: `sign-${n}`, x, y: 2, ...elevatorSign(f, n, !!f?.unlocked, !!f?.cleared) });
    if (f?.unlocked) exits.push({ x, y: 2, to: `/floor/${n}` });
  }

  const p0 = byFloor(0);
  // The Daily elevator is always an exit; Lobby.tsx answers it with a LOCKED note until
  // tutorial clear (account or this browser). Blocking the cell made it feel broken.
  const today = dailyCase(todayUtc());
  exits.push({ x: DAILY_X, y: 2, to: "/daily" });
  // Readable props sit on the mats (the exit tiles), like the floors' elevator signs.
  props.push({
    id: "daily-sign",
    x: DAILY_X,
    y: 2,
    label: `Daily Case · ${today.title}`,
    text: `A new case every day, the same for everyone. Today: ${today.employee.name}, ${today.employee.title.toLowerCase()} at ${today.place}. ${p0?.cleared ? "Step into the elevator to play." : "Opens once you clear the tutorial."}`,
  });
  props.push({
    id: "street-sign",
    x: TUTORIAL_X,
    y: 2,
    label: `Tutorial${p0?.cleared ? " · CLEARED" : ""}`,
    text: "The tutorial: Barry is closing up the little branch across the street. Step into the elevator to try your first con.",
  });
  props.push({
    id: "reception",
    x: 9,
    y: 6,
    label: "Reception: tower directory",
    text: "Plumpurse Savings & Trust. Floor 1 Accounts Payable, Floor 2 the Trading Floor, Floor 3 the Executive Penthouse. Each floor's vault is stricter than the one below. Clear a floor to unlock the next elevator.",
  });
  props.push({
    id: "daily-board",
    x: 2,
    y: 9,
    label: `Daily Case · ${today.title}`,
    text: `A new short case every day, the same for everyone. Today: ${today.employee.name}, ${today.employee.title.toLowerCase()} at ${today.place}. Full board at /leaderboard?floor=daily.`,
  });
  const top = floors
    .flatMap((f) => f.board.slice(0, 1).map((b) => `${f.floor === 0 ? "Tutorial" : `Floor ${f.floor}`}: ${b.name} ${clock(b.ms)}`))
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
    spawn: entranceSpawn(entrance) ?? { x: MID_X, y: H - 3, facing: "up" },
    npcs: [],
    props,
    exits,
  };
}

export { H as LOBBY_H, W as LOBBY_W };

/** Each elevator's name plate, on its door: the same boxed label the floors use for LOBBY, always shown. */
export const ELEVATOR_NAMES: { x: number; y: number; text: string; always: true; fit: number }[] = [
  { x: TUTORIAL_X, y: 1, text: "TUTORIAL", always: true, fit: 2.8 },
  ...Object.entries(ELEVATORS).map(([n, x]) => ({ x, y: 1, text: `FLOOR ${n}`, always: true as const, fit: 2.8 })),
  { x: DAILY_X, y: 1, text: "DAILY", always: true, fit: 2.8 },
];

/** Where a player should head next from the lobby: the next elevator to ride. */
export function lobbyGuide(floors: TowerFloor[]): {
  goal: { x: number; y: number } | null;
  tags: { x: number; y: number; text: string; endAt?: "x"; mat?: boolean }[];
} {
  const f0 = floors.find((f) => f.floor === 0);
  if (!f0?.cleared) return { goal: { x: TUTORIAL_X, y: 2 }, tags: [] };
  const next = floors.find((f) => f.floor > 0 && f.unlocked && !f.cleared);
  if (!next) return { goal: null, tags: [] };
  const x = ELEVATORS[next.floor as 1 | 2 | 3];
  return { goal: { x, y: 2 }, tags: [] };
}
