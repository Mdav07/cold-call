// Seasonal cases: a holiday case (Thanksgiving first) behind its own door in the lobby, separate from the
// Daily Case. One hand-written case per season, open between two dates (UTC), from
// content/seasonal/seasons.json. A season with no "case" yet is announced as "coming".
//
// A seasonal run is a Daily-floor run (floor 4) whose daily_date is the season's reserved caseDate
// (year 2000). Marisol is the "daily" agent; Dev is the "helper" second signer (Floor-2 style 2-of-2).
// Streaks, the Daily board and Daily unlocks skip these dates (isSeasonalDate). Pure TS: safe to import anywhere.

import seasonsFile from "@/content/seasonal/seasons.json";
import type { DailyCase, DailyTheme } from "@/shared/dailyCase";

type SeasonCase = Omit<DailyCase, "date" | "theme" | "capUsdc">;

export interface Season {
  id: string;
  name: string; // e.g. "Thanksgiving"
  opens: string; // YYYY-MM-DD (UTC), first day open
  closes: string; // YYYY-MM-DD (UTC), last day open
  caseDate: string; // the reserved daily_date for its runs (year 2000)
  door: string;
  theme?: DailyTheme;
  case?: SeasonCase;
  /** Live second signer (ElevenLabs "helper" agent): walk up and convince them. */
  helper?: SeasonHelper;
}

export interface SeasonHelper {
  id: "helper";
  name: string;
  firstName: string;
  title: string;
  sprite: string;
  personality: string;
  softSpot: string;
  /** The verification detail they insist on (e.g. pie count). */
  check: string;
}

export const SEASONS = seasonsFile.seasons as Season[];
export const SEASONAL_THEMES: DailyTheme[] = SEASONS.flatMap((s) => (s.theme ? [s.theme] : []));
/** Seasonal cases are harder than the Daily, for a medium prize: 50 cents (the Daily pays 10). */
export const SEASONAL_CAP_USDC = 0.5;
export const SEASONAL_CAP_UNITS = 500_000;
/** The seasonal employee starts warier than the Daily's (10). */
export const SEASONAL_START_SUSPICION = 25;

const today = (ms: number = Date.now()) => new Date(ms).toISOString().slice(0, 10);

/** A seasonal run's reserved date (year 2000): never a real Daily Case day. */
export const isSeasonalDate = (date: string | null | undefined): boolean => !!date && date.startsWith("2000-");

/** The season open today (with a case), or null. */
export function currentSeason(ms: number = Date.now()): Season | null {
  const d = today(ms);
  return SEASONS.find((s) => s.case && s.opens <= d && d <= s.closes) ?? null;
}

/** The next season to open after today, or null. */
export function nextSeason(ms: number = Date.now()): Season | null {
  const d = today(ms);
  return SEASONS.filter((s) => s.opens > d).sort((a, b) => a.opens.localeCompare(b.opens))[0] ?? null;
}

/** "Dec 14" */
export function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** The seasonal case played on this reserved date, or null. */
export function seasonalCase(date: string): DailyCase | null {
  const s = SEASONS.find((x) => x.caseDate === date && x.case);
  if (!s?.case) return null;
  return { ...s.case, date: s.caseDate, theme: s.theme?.id ?? "harvest", capUsdc: SEASONAL_CAP_USDC };
}

/** A valid case date for a seasonal run: the reserved date of the season open today, else null. */
export function openSeasonalDate(date: string | null | undefined, ms: number = Date.now()): string | null {
  const s = currentSeason(ms);
  return s && date === s.caseDate ? date : null;
}

/** The season's live helper for this reserved date, or null. */
export function seasonalHelper(date: string | null | undefined): SeasonHelper | null {
  if (!date) return null;
  return SEASONS.find((x) => x.caseDate === date)?.helper ?? null;
}
