// The Daily Case: one short level a day, the same for everyone. Built from content/daily/templates.json,
// seeded by the UTC date, so the server (session, tools, leaderboard) and the browser (room, case file,
// popup) always agree on today's case. Pure TS: safe to import anywhere.
//
// Contract between 88a8 and 6b5c (.plans/daily.md). Floor 4 in the run tables; employee id "daily".

import templates from "@/content/daily/templates.json";
import themesFile from "@/content/daily/themes.json";
import { seasonalCase } from "@/shared/seasonalCase";

export const DAILY_FLOOR = 4;
export const DAILY_EMPLOYEE = "daily";
export const DAILY_CAP_USDC = 0.1;

type Place = { title: string; place: string; role: string; duty: string; business?: string };
type Vendor = { name: string; prefix: string; what: string; job: string };

/** A themed workplace (content/daily/themes.json). Tile values are names in app/floor/maps/tiles.json. */
export interface DailyTheme {
  id: string; // e.g. "restaurant", "bank-branch"
  name: string;
  business?: string; // bank themes: "Plumpurse"; the others name the business per place
  float: string; // what small bills are paid from, e.g. "the till"
  pool?: "templates"; // bank themes draw places, vendors and flavour from templates.json
  tiles: {
    floor: string;
    wall: string;
    walltop: string;
    window: string;
    board: string; // wall-kind clue board
    station: string; // block, holds clues (replaces the counter)
    station_note: string; // the station with a note on it
    decor: string[]; // 3 block pieces, against walls
    seat: string; // walk
  };
  places?: Place[];
  vendors?: Vendor[];
  flavour?: string[];
}

export const DAILY_THEMES = themesFile.themes as DailyTheme[];

export interface DailyCase {
  date: string; // YYYY-MM-DD (UTC)
  theme: string; // DailyTheme.id
  business: string; // the name the employee answers with, e.g. "Plumpurse", "Rosso's Trattoria"
  float: string; // what the bill is paid from, e.g. "the branch float", "the till"
  title: string; // e.g. "The Night Desk"
  place: string; // one line, e.g. "Plumpurse Harbor Annex, after hours"
  brief: [string, string]; // Krystal's two short briefing screens
  employee: {
    name: string;
    firstName: string;
    title: string;
    sprite: string; // "/sprites/<file>.png"
    personality: string; // one line, for the agent and the case file
    tic: string; // a verbal habit, for the agent
    softSpot: string; // what lowers their guard (the way in)
    redLine: string; // what they will never do
  };
  vendors: { name: string; code: string; what: string }[]; // today's registry (3)
  allowedVendor: string; // the one vendor they can pay today
  allowedJob: string; // the job the allowed vendor is booked for
  allowedInvoice: string; // e.g. "KR-3381"
  clues: { id: string; label: string; text: string }[]; // 4 notes to place as props in the room
  capUsdc: number;
}

/** Today's date in UTC, YYYY-MM-DD (the same rule as the Daily Contract). */
export function todayUtc(ms: number = Date.now()): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** How many days of cases the archive offers (today included). Earlier days are practice. */
export const DAILY_ARCHIVE_DAYS = 6;

/** Today first, then the days before it (UTC), `n` in all. */
export function recentDailyDates(n: number = DAILY_ARCHIVE_DAYS, ms: number = Date.now()): string[] {
  return Array.from({ length: n }, (_, i) => todayUtc(ms - i * 86_400_000));
}

/** A valid case date the archive offers (today or up to DAILY_ARCHIVE_DAYS - 1 days back), else null. */
export function archiveDate(date: string | null | undefined, ms: number = Date.now()): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return recentDailyDates(DAILY_ARCHIVE_DAYS, ms).includes(date) ? date : null;
}

/** A small, fast, seeded PRNG (mulberry32) from a string. */
function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;

// ---------- No-repeat rotation (a4c9's design) ----------
const EPOCH = Date.UTC(2026, 10, 18); // 2026-11-18, day 0 of the first cycle
const dayIndex = (day: string) => Math.floor((Date.parse(`${day}T00:00:00Z`) - EPOCH) / 86_400_000);

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** A seeded shuffle of 0..n-1. */
function order(n: number, seed: string): number[] {
  const r = rng(seed);
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * The order for cycle c: a fresh shuffle whose first week avoids the previous cycle's last week, so
 * nothing comes back within about a week across the seam. Each cycle is guarded against the order the
 * previous cycle really used, so the chain starts from a fixed cycle (well before the epoch) and is
 * memoised.
 */
const FIRST_CYCLE = -8;
const cycleMemo = new Map<string, number[]>();
function cycleOrder(n: number, salt: string, c: number): number[] {
  const key = `${n}:${salt}:${c}`;
  const hit = cycleMemo.get(key);
  if (hit) return hit;
  const cur = order(n, `${salt}:${c}`);
  const w = Math.min(7, Math.floor(n / 2));
  if (w > 0 && c > FIRST_CYCLE) {
    const prev = cycleOrder(n, salt, c - 1);
    const tail = new Set(prev.slice(n - w));
    for (let i = 0; i < w; i++) {
      if (!tail.has(cur[i])) continue;
      const j = cur.findIndex((x, idx) => idx >= w && !tail.has(x));
      if (j >= 0) [cur[i], cur[j]] = [cur[j], cur[i]];
    }
  }
  cycleMemo.set(key, cur);
  return cur;
}

/** Every index once per cycle of n days, in a fresh order each cycle, never repeating within a week. */
export function cycled(day: string, n: number, salt: string): number {
  const i = dayIndex(day);
  const c = Math.floor(i / n);
  const k = ((i % n) + n) % n;
  return cycleOrder(n, salt, c)[k];
}

export function dailyCase(date: string = todayUtc()): DailyCase {
  // A seasonal run's reserved date (shared/seasonalCase.ts) plays the hand-written holiday case.
  const seasonal = seasonalCase(date);
  if (seasonal) return seasonal;
  const day = VALID_DATE.test(date) ? date : todayUtc();
  const r = rng(`coldcall-daily:${day}`);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
  const shuffle = <T,>(xs: readonly T[]): T[] => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // The theme rotates (every theme once per cycle, never within a week of itself), and so does the place
  // inside it: a bank theme takes the bank pool's rotation; a themed workplace takes its next place each
  // time the theme comes round.
  const theme = DAILY_THEMES[cycled(day, DAILY_THEMES.length, "theme")];
  const own = theme.pool !== "templates" && theme.places?.length && theme.vendors?.length && theme.flavour?.length;
  const places: Place[] = own ? theme.places! : templates.places;
  const pool = { vendors: own ? theme.vendors! : templates.vendors, flavour: own ? theme.flavour! : templates.flavour };
  const place = own
    ? places[order(places.length, `place:${theme.id}`)[mod(Math.floor(dayIndex(day) / DAILY_THEMES.length), places.length)]]
    : places[cycled(day, places.length, "place")];
  const business = place.business ?? theme.business ?? "Plumpurse";
  const firstName = pick(templates.firstNames);
  const name = `${firstName} ${pick(templates.lastNames)}`;
  const sprite = pick(templates.sprites);
  const personality = pick(templates.personalities);
  const soft = pick(templates.softSpots);
  const red = pick(templates.redLines);
  const flavour = pick(pool.flavour);

  const three = shuffle(pool.vendors).slice(0, 3);
  const codeOf = (prefix: string) => `${prefix}-${1000 + Math.floor(r() * 9000)}`;
  const vendors = three.map((v) => ({ name: v.name, code: codeOf(v.prefix), what: v.what }));
  const allowedIdx = Math.floor(r() * vendors.length);
  const allowed = three[allowedIdx];
  const allowedInvoice = vendors[allowedIdx].code;

  const clues = shuffle([
    {
      id: "work-order",
      label: "Work order",
      text: `${allowed.name} is booked today to ${allowed.job}. Invoice ${allowedInvoice}, pay on completion (10 cents max from ${theme.float}).`,
    },
    { id: "soft-spot", label: `${firstName}'s desk`, text: soft.clue },
    { id: "red-line", label: "Note by the phone", text: red.clue },
    { id: "flavour", label: "Odds and ends", text: flavour },
  ]);

  return {
    date: day,
    theme: theme.id,
    business,
    float: theme.float,
    title: place.title,
    place: place.place,
    brief: [
      `Today's case: ${place.place}. ${name}, the ${place.role.toLowerCase()}, is alone, ${place.duty}.`,
      `Talk ${firstName} into one small payment to a vendor on today's list. Read the notes in the room first.`,
    ],
    employee: {
      name,
      firstName,
      title: place.role,
      sprite,
      personality: personality.text,
      tic: personality.tic,
      softSpot: soft.text,
      redLine: red.text,
    },
    vendors,
    allowedVendor: allowed.name,
    allowedJob: allowed.job,
    allowedInvoice,
    clues,
    capUsdc: DAILY_CAP_USDC,
  };
}
