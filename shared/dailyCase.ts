// The Daily Case: one short level a day, the same for everyone. Built from content/daily/templates.json,
// seeded by the UTC date, so the server (session, tools, leaderboard) and the browser (room, case file,
// popup) always agree on today's case. Pure TS: safe to import anywhere.
//
// Contract between 88a8 and 6b5c (.plans/daily.md). Floor 4 in the run tables; employee id "daily".

import templates from "@/content/daily/templates.json";

export const DAILY_FLOOR = 4;
export const DAILY_EMPLOYEE = "daily";
export const DAILY_CAP_USDC = 0.1;

export interface DailyCase {
  date: string; // YYYY-MM-DD (UTC)
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
export const DAILY_ARCHIVE_DAYS = 7;

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

export function dailyCase(date: string = todayUtc()): DailyCase {
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

  const place = pick(templates.places);
  const firstName = pick(templates.firstNames);
  const name = `${firstName} ${pick(templates.lastNames)}`;
  const sprite = pick(templates.sprites);
  const personality = pick(templates.personalities);
  const soft = pick(templates.softSpots);
  const red = pick(templates.redLines);
  const flavour = pick(templates.flavour);

  const three = shuffle(templates.vendors).slice(0, 3);
  const codeOf = (prefix: string) => `${prefix}-${1000 + Math.floor(r() * 9000)}`;
  const vendors = three.map((v) => ({ name: v.name, code: codeOf(v.prefix), what: v.what }));
  const allowedIdx = Math.floor(r() * vendors.length);
  const allowed = three[allowedIdx];
  const allowedInvoice = vendors[allowedIdx].code;

  const clues = shuffle([
    {
      id: "work-order",
      label: "Work order",
      text: `${allowed.name} is booked today to ${allowed.job}. Invoice ${allowedInvoice}, pay on completion (10 cents max from the branch float).`,
    },
    { id: "soft-spot", label: `${firstName}'s desk`, text: soft.clue },
    { id: "red-line", label: "Note by the phone", text: red.clue },
    { id: "flavour", label: "Odds and ends", text: flavour },
  ]);

  return {
    date: day,
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
