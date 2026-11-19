// Holiday cases: a case behind the lobby's holiday door, separate from the Daily Case. Ten holidays, each open on
// its dated windows (UTC, inclusive) from content/seasonal/seasons.json (built by tools/seasonal/build_seasons.py).
// While a window is open its layouts (place, people, vendors, notes) rotate day by day, never the same two days
// running. Two holidays can be open at once (Halloween + Diwali, Christmas + Hanukkah in 2027): the door asks which.
//
// A holiday run is a Daily-floor run (floor 4) whose daily_date is the layout's reserved year-2000 caseDate, unique
// per layout per window, so a run always replays the layout it started on and each year has its own board.
// The proposer is the "daily" agent; the co-signer is the "helper" agent (Floor-2 style 2-of-2).
// Streaks, the Daily board and Daily unlocks skip these dates (isSeasonalDate). Pure TS: safe to import anywhere.

import seasonsFile from "@/content/seasonal/seasons.json";
import type { DailyCase, DailyTheme } from "@/shared/dailyCase";

type SeasonCase = Omit<DailyCase, "date" | "theme" | "capUsdc">;

export interface SeasonHelper {
  id: "helper";
  name: string;
  firstName: string;
  title: string;
  sprite: string;
  personality: string;
  softSpot: string;
  /** The changed number they insist on (e.g. "thirty-eight pies"). */
  check: string;
  /** How they answer the phone. */
  firstMessage: string;
}

export interface SeasonLayout {
  case: SeasonCase;
  helper: SeasonHelper;
  /** ElevenLabs voice ids for this layout's payer ("daily") and co-signer ("helper"), matched to each character. */
  voices: { daily: string; helper: string };
}

/** Lobby dressing while the holiday is open (tile names in app/floor/maps/tiles.json), or null until its art lands. */
export interface SeasonLobby {
  door: string;
  mat: string;
  lobby: string[];
  garland: string;
}

interface SeasonDef {
  id: string; // "halloween"
  name: string; // "Halloween"
  fx: string; // weather effect over the room and lobby: "leaves", "snow", ...
  signoff: string; // Krystal's line on a clear
  art: boolean; // false: the room still borrows the harvest tiles
  theme: DailyTheme;
  lobby: SeasonLobby | null;
  windows: { opens: string; closes: string; caseDates: string[] }[];
  layouts: SeasonLayout[];
}

/** One holiday in one year: "halloween-2027". */
export interface Season {
  id: string;
  key: string; // the holiday: "halloween"
  name: string;
  fx: string;
  signoff: string;
  art: boolean;
  opens: string; // YYYY-MM-DD (UTC), first day open
  closes: string; // YYYY-MM-DD (UTC), last day open
  theme: DailyTheme;
  lobby: SeasonLobby | null;
  layouts: SeasonLayout[];
  /** caseDates[i]: layout i's reserved run date in this window. */
  caseDates: string[];
}

const DEFS = seasonsFile.seasons as unknown as SeasonDef[];

export const SEASONS: Season[] = DEFS.flatMap((d) =>
  d.windows.map((w) => ({
    id: `${d.id}-${w.opens.slice(0, 4)}`,
    key: d.id,
    name: d.name,
    fx: d.fx,
    signoff: d.signoff,
    art: d.art,
    opens: w.opens,
    closes: w.closes,
    theme: d.theme,
    lobby: d.lobby,
    layouts: d.layouts,
    caseDates: w.caseDates,
  })),
).sort((a, b) => a.opens.localeCompare(b.opens));

export const SEASONAL_THEMES: DailyTheme[] = DEFS.map((d) => d.theme).filter(
  (t, i, all) => all.findIndex((x) => x.id === t.id) === i,
);
/** Holiday cases are harder than the Daily, for a medium prize: 50 cents (the Daily pays 10). */
export const SEASONAL_CAP_USDC = 0.5;
export const SEASONAL_CAP_UNITS = 500_000;
/** The holiday proposer starts warier than the Daily's (10). */
export const SEASONAL_START_SUSPICION = 25;

const today = (ms: number = Date.now()) => new Date(ms).toISOString().slice(0, 10);
const DAY = 86_400_000;

/** A holiday run's reserved date (year 2000): never a real Daily Case day. */
export const isSeasonalDate = (date: string | null | undefined): boolean => !!date && date.startsWith("2000-");

/** Every holiday open today, earliest-opened first (usually one, at most two). */
export function openSeasons(ms: number = Date.now()): Season[] {
  const d = today(ms);
  return SEASONS.filter((s) => s.opens <= d && d <= s.closes);
}

/** The first holiday open today, or null. */
export function currentSeason(ms: number = Date.now()): Season | null {
  return openSeasons(ms)[0] ?? null;
}

/** The next holiday to open after today, or null. */
export function nextSeason(ms: number = Date.now()): Season | null {
  const d = today(ms);
  return SEASONS.find((s) => s.opens > d) ?? null;
}

/** "Dec 14" */
export function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** A small seeded PRNG (mulberry32) from a string. */
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

function shuffled(n: number, seed: string): number[] {
  const r = rng(seed);
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Which layout a holiday plays on a day: every layout once per cycle of n days, a fresh order each cycle,
 * never the same layout two days running (across the seam either).
 */
export function layoutIndex(s: Season, ms: number = Date.now()): number {
  const n = s.layouts.length;
  if (n <= 1) return 0;
  const i = Math.max(0, Math.floor((Date.parse(`${today(ms)}T00:00:00Z`) - Date.parse(`${s.opens}T00:00:00Z`)) / DAY));
  const cycle = (c: number): number[] => {
    const o = shuffled(n, `coldcall-season:${s.id}:${c}`);
    if (c > 0 && o[0] === cycle(c - 1)[n - 1]) [o[0], o[1]] = [o[1], o[0]];
    return o;
  };
  return cycle(Math.floor(i / n))[i % n];
}

/** Today's reserved run date for an open holiday. */
export function todaysCaseDate(s: Season, ms: number = Date.now()): string {
  return s.caseDates[layoutIndex(s, ms)];
}

/** The holiday (in its year) a reserved date belongs to, and which layout. */
function find(date: string | null | undefined): { season: Season; layout: SeasonLayout } | null {
  if (!isSeasonalDate(date)) return null;
  for (const s of SEASONS) {
    const i = s.caseDates.indexOf(date!);
    if (i >= 0) return { season: s, layout: s.layouts[i] };
  }
  return null;
}

/** The holiday a reserved date belongs to, or null. */
export function seasonOfDate(date: string | null | undefined): Season | null {
  return find(date)?.season ?? null;
}

/** A holiday by id ("halloween-2027") or by key ("halloween", the latest window of it), or null. */
export function seasonById(id: string | null | undefined, ms: number = Date.now()): Season | null {
  if (!id) return null;
  return (
    SEASONS.find((s) => s.id === id) ??
    openSeasons(ms).find((s) => s.key === id) ??
    [...SEASONS].reverse().find((s) => s.key === id && s.opens <= today(ms)) ??
    null
  );
}

/** The holiday case played on this reserved date, or null. */
export function seasonalCase(date: string): DailyCase | null {
  const f = find(date);
  if (!f) return null;
  return { ...f.layout.case, date, theme: f.season.theme.id, capUsdc: SEASONAL_CAP_USDC };
}

/**
 * A valid date for a holiday run right now: a reserved date of a holiday open today (any of its layouts, so a run
 * that started before midnight keeps its layout), else null.
 */
export function openSeasonalDate(date: string | null | undefined, ms: number = Date.now()): string | null {
  const s = seasonOfDate(date);
  return s && openSeasons(ms).some((o) => o.id === s.id) ? date! : null;
}

/** The ElevenLabs voice for an employee on this reserved date (payer or co-signer), or null off a holiday case. */
export function seasonalVoice(date: string | null | undefined, employee: string): string | null {
  const v = find(date)?.layout.voices;
  return v ? (employee === "helper" ? v.helper : employee === "daily" ? v.daily : null) : null;
}

/** The co-signer for this reserved date, or null. */
export function seasonalHelper(date: string | null | undefined): SeasonHelper | null {
  return find(date)?.layout.helper ?? null;
}
