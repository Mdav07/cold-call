// Seasonal cases: a holiday case (Thanksgiving first) behind its own door in the lobby, separate from the
// Daily Case. One hand-written case per season, open between two dates (UTC), from
// content/seasonal/seasons.json. A season with no "case" yet is announced as "coming".
//
// A seasonal run is a Daily-floor run (floor 4, the "daily" agent, the Pocket Branch vault) whose
// daily_date is the season's reserved caseDate (year 2000, never a real Daily Case day). dailyCase()
// returns the seasonal case for that date, so the session, the agent's persona, the tools' vendor check
// and the payout rule all follow without changes. Streaks, the Daily board and Daily unlocks skip these
// dates (isSeasonalDate). Pure TS: safe to import anywhere.

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
  /** A second person in the room with fixed lines (no AI): walk up to them for a key detail. */
  helper?: SeasonHelper;
}

export interface SeasonHelper {
  id: string;
  name: string;
  title: string;
  sprite: string;
  text: string; // a one-paragraph summary (the case file, and anywhere the conversation can't run)
  /** A short back-and-forth: their line (spoken: public/audio, agents/generate-audio.ts) and your replies. */
  dialogue?: HelperLine[];
}

export interface HelperLine {
  id: string;
  line: string;
  audio?: string;
  /** Your replies; next is the line they lead to, or null to end the conversation. */
  choices: { text: string; next: string | null }[];
}

export const SEASONS = seasonsFile.seasons as Season[];
export const SEASONAL_THEMES: DailyTheme[] = SEASONS.flatMap((s) => (s.theme ? [s.theme] : []));
/** Seasonal cases are harder than the Daily, for a medium prize: 50 cents (the Daily pays 10), from the
 *  same Pocket Branch vault ($1 per-transfer limit). server/chain/tools.ts caps seasonal runs here too. */
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
