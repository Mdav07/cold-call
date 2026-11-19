// Checks the holiday cases before every build (npm run build runs it first):
//  - every layout is winnable: the booked vendor is on the list, its invoice is in the work order, every note exists;
//  - reserved dates are unique, all year-2000, and never a real Daily Case date;
//  - no more than two holidays are open on any day;
//  - the rotation never plays the same layout two days running;
//  - every tile a holiday names exists. A holiday opening within 30 days on borrowed harvest art is a warning.
//   npx tsx --tsconfig tsconfig.json tools/seasonal/check_seasons.ts
import tilesFile from "../../app/floor/maps/tiles.json";
import { SEASONS, isSeasonalDate, layoutIndex, openSeasons, seasonalCase } from "../../shared/seasonalCase";

const TILES = tilesFile.tiles as Record<string, unknown>;
const errors: string[] = [];
const warnings: string[] = [];
const DAY = 86_400_000;

const dates = new Map<string, string>();
for (const s of SEASONS) {
  if (s.caseDates.length !== s.layouts.length) errors.push(`${s.id}: ${s.caseDates.length} dates for ${s.layouts.length} layouts`);
  s.caseDates.forEach((d, i) => {
    if (!isSeasonalDate(d)) errors.push(`${s.id}: layout ${i + 1} date ${d} is not a reserved year-2000 date`);
    if (dates.has(d)) errors.push(`${s.id}: date ${d} is also used by ${dates.get(d)}`);
    dates.set(d, `${s.id} layout ${i + 1}`);
    const c = seasonalCase(d);
    if (!c) return void errors.push(`${s.id}: no case for ${d}`);
    const booked = c.vendors.find((v) => v.name === c.allowedVendor);
    if (!booked) errors.push(`${s.id} "${c.title}": booked vendor isn't on the vendor list`);
    else if (booked.code !== c.allowedInvoice) errors.push(`${s.id} "${c.title}": invoice ${c.allowedInvoice} isn't the booked vendor's`);
    if (!c.clues.some((x) => x.text.includes(c.allowedInvoice))) errors.push(`${s.id} "${c.title}": no note names the invoice`);
    if (c.clues.length !== 4) errors.push(`${s.id} "${c.title}": ${c.clues.length} notes, want 4`);
    if (new Set(c.vendors.map((v) => v.code.split("-")[0])).size !== 3) errors.push(`${s.id} "${c.title}": vendor prefixes repeat`);
  });
  const t = s.theme.tiles;
  const names = [t.floor, t.wall, t.walltop, t.window, t.board, t.station, t.station_note, t.seat, ...t.decor];
  if (s.lobby) names.push(s.lobby.door, s.lobby.mat, s.lobby.garland, ...s.lobby.lobby);
  for (const n of names) if (!TILES[n]) errors.push(`${s.id}: tile "${n}" isn't in app/floor/maps/tiles.json`);
}

// Day by day over every window: at most two holidays open, no layout twice in a row.
const first = Math.min(...SEASONS.map((s) => Date.parse(`${s.opens}T00:00:00Z`)));
const last = Math.max(...SEASONS.map((s) => Date.parse(`${s.closes}T00:00:00Z`)));
const prev = new Map<string, number>();
for (let ms = first; ms <= last; ms += DAY) {
  const open = openSeasons(ms);
  if (open.length > 2) errors.push(`${new Date(ms).toISOString().slice(0, 10)}: ${open.length} holidays open (${open.map((s) => s.id).join(", ")})`);
  for (const s of open) {
    const i = layoutIndex(s, ms);
    if (prev.get(s.id) === i && s.layouts.length > 1) errors.push(`${s.id}: layout ${i + 1} plays two days running at ${new Date(ms).toISOString().slice(0, 10)}`);
    prev.set(s.id, i);
  }
}

const now = Date.now();
for (const s of SEASONS) {
  const until = (Date.parse(`${s.opens}T00:00:00Z`) - now) / DAY;
  if (!s.art && until <= 30 && Date.parse(`${s.closes}T00:00:00Z`) >= now - DAY)
    warnings.push(`${s.id} opens ${s.opens} and still borrows the harvest room art`);
}

for (const w of warnings) console.warn(`seasons: warning: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`seasons: ${e}`);
  process.exit(1);
}
console.log(`seasons: ${SEASONS.length} holiday windows, ${dates.size} layouts checked`);
