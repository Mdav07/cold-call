// Bug check for every Daily Case and every holiday case, as the game builds them.
//
//   npx tsx --tsconfig tsconfig.json tools/cases/check_cases.ts [days=365]
//
// For each Daily Case (the archive days, then `days` days ahead) and each holiday layout:
//  - the case is winnable on paper: the booked vendor is on the list with the right invoice, the work order
//    names both, the soft-spot and red-line notes exist, the cap in the notes is the case's cap, no placeholder
//    text leaked ("{{", "undefined", "NaN");
//  - holiday cases: the co-signer's number is in the job and in a note, the notes name both signers, and no
//    note sends the player to a person for a detail that person won't give (the Thanksgiving bug);
//  - the room builds and follows the engine's rules: every person, note and the way out can be reached from
//    the spawn, nothing blocks movement where nothing is drawn (people excepted), furniture you can't walk
//    through is solid, no one stands in a wall, every note is in the room;
//  - the lobby builds with each holiday's dressing;
//  - every {{variable}} the agents' rule sheets use is one the server sends.
// Exits 1 on any problem and prints each one.
import { readFileSync } from "node:fs";
import tilesFile from "../../app/floor/maps/tiles.json";
import type { FloorMap } from "../../app/floor/types";
import { buildDailyRoom } from "../../app/daily/room";
import { buildLobby } from "../../app/tower/lobbyMap";
import { dailyCase, recentDailyDates, todayUtc, type DailyCase } from "../../shared/dailyCase";
import { SEASONS, seasonalHelper, type SeasonHelper } from "../../shared/seasonalCase";

const DAYS = Number(process.argv[2] ?? 365);
const DAY = 86_400_000;
const KIND = new Map<number, { name: string; kind: string }>(
  Object.entries(tilesFile.tiles as Record<string, { index: number; kind: string }>).map(([name, t]) => [t.index, { name, kind: t.kind }]),
);
const problems: string[] = [];
const add = (where: string, what: string) => problems.push(`${where}: ${what}`);
const cents = (usdc: number) => `${Math.round(usdc * 100)} cents`;

// ---------- case text ----------
function checkCase(where: string, c: DailyCase, helper: SeasonHelper | null) {
  const text = JSON.stringify(c);
  for (const bad of ["{{", "undefined", "NaN", "[object Object]"]) if (text.includes(bad)) add(where, `text contains "${bad}"`);
  const booked = c.vendors.find((v) => v.name === c.allowedVendor);
  if (c.vendors.length !== 3) add(where, `${c.vendors.length} vendors, want 3`);
  if (!booked) add(where, `booked vendor "${c.allowedVendor}" isn't on the vendor list`);
  else if (booked.code !== c.allowedInvoice) add(where, `invoice ${c.allowedInvoice} isn't ${booked.name}'s (${booked.code})`);
  if (new Set(c.vendors.map((v) => v.code)).size !== c.vendors.length) add(where, "two vendors share an invoice code");
  if (new Set(c.vendors.map((v) => v.code.split("-")[0])).size !== c.vendors.length) add(where, "two vendors share an invoice prefix");
  if (new Set(c.vendors.map((v) => v.name)).size !== c.vendors.length) add(where, "a vendor is listed twice");
  const ids = c.clues.map((x) => x.id);
  if (c.clues.length !== 4) add(where, `${c.clues.length} notes, want 4`);
  if (new Set(ids).size !== ids.length) add(where, "two notes share an id");
  const work = c.clues.find((x) => x.id === "work-order");
  if (!work) add(where, "no work order note");
  else {
    if (!work.text.includes(c.allowedVendor)) add(where, "the work order doesn't name the booked vendor");
    if (!work.text.includes(c.allowedInvoice)) add(where, "the work order doesn't give the invoice");
    if (!work.text.includes(cents(c.capUsdc))) add(where, `the work order's cap isn't ${cents(c.capUsdc)}`);
  }
  if (!ids.includes("soft-spot")) add(where, "no soft-spot note");
  if (!ids.includes("red-line")) add(where, "no red-line note");
  for (const x of c.clues) {
    const m = x.text.match(/(\d+) cents/g);
    for (const s of m ?? []) if (s !== cents(c.capUsdc)) add(where, `note "${x.label}" says ${s}, the cap is ${cents(c.capUsdc)}`);
  }
  if (!c.brief.join(" ").includes(c.employee.firstName)) add(where, "the briefing doesn't name the employee");
  // Clashes between what wins and what loses: the player has to describe the job, so it can't trip the red line.
  const red = c.employee.redLine.toLowerCase();
  const job = `${c.allowedVendor} ${c.allowedJob}`;
  if (/computers|technology/.test(red) && /\b(computer|internet|wi-?fi|network|server|software|laptop|printer|router|keycard|crypto)\b/i.test(job))
    add(where, `the red line bans talk the booked job needs ("${c.allowedJob}")`);
  if (/rush|hurr/.test(red) && /helps? them finish|finish (early|sooner|before)|get (it|this) done (quick|fast)|before .*(check|close|deadline)/i.test(c.employee.softSpot))
    add(where, "the soft spot (speed) is the red line (rushing)");
  // A soft spot that asks for something "by name" needs that name in a note, or nobody can know it.
  const notes = c.clues.map((x) => x.text).join(" ");
  for (const [who, spot] of [[c.employee.firstName, c.employee.softSpot], [helper?.firstName, helper?.softSpot]] as const) {
    if (!spot || !/by name/i.test(spot)) continue;
    const names = (spot.match(/\b[A-Z][a-z]+(?: [A-Z][a-z]+)*\b/g) ?? []).filter((n) => !/^(Anyone|A|Asking|Talk|Talking)$/.test(n.split(" ")[0]) || n.includes(" "));
    if (!names.some((n) => notes.includes(n))) add(where, `${who}'s soft spot wants a name ("${spot}") that no note gives`);
  }
  const soft = `${c.employee.softSpot} ${helper?.softSpot ?? ""}`.toLowerCase();
  const NUM: Record<string, string> = { zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9" };
  const banned = soft.match(/never says (?:the number )?([a-z]+|\d)/)?.[1];
  if (banned && c.allowedInvoice.includes(NUM[banned] ?? banned)) add(where, `a soft spot is never saying "${banned}", but the invoice has it`);
  if (helper) {
    const all = c.clues.map((x) => x.text).join(" ");
    const num = helper.check.split(" ")[0].replace(/,/g, "");
    const has = (t: string) => t.replace(/,/g, "").toLowerCase().includes(num.toLowerCase());
    if (!has(c.allowedJob)) add(where, `the job doesn't contain the co-signer's number (${helper.check})`);
    if (!has(all)) add(where, `no note gives the co-signer's number (${helper.check})`);
    if (work && !(work.text.includes(c.employee.firstName) && work.text.includes(helper.firstName)))
      add(where, "the work order doesn't say who proposes and who co-signs");
    // A note that sends the player to a person for a detail: the co-signer never says the number.
    if (/get (the|it|that)[^.]*from (the kitchen|him|her|them|the [a-z-]+ (lead|chef|cook|clerk|treasurer))/i.test(all))
      add(where, "a note tells the player to get a detail from someone who won't give it");
    if (!c.employee.redLine.includes(helper.firstName)) add(where, "the payer's red line doesn't mention the co-signer");
  }
}

// ---------- rooms (the engine's rules) ----------
function checkMap(where: string, m: FloorMap, clueCount: number | null) {
  const { width: w, height: h } = m;
  const { ground, walls, decor } = m.layers;
  const blocked = new Set(m.blocked ?? []);
  const npcCells = new Set(m.npcs.map((n) => n.y * w + n.x));
  const at = (x: number, y: number) => y * w + x;
  const drawn = (i: number) => walls[i] >= 0 || decor[i] >= 0;
  for (let i = 0; i < w * h; i++) {
    const t = KIND.get(decor[i]);
    if (decor[i] >= 0 && t?.kind === "block" && !blocked.has(i) && walls[i] < 0 && !npcCells.has(i))
      add(where, `walk-through furniture: ${t.name} at (${i % w},${Math.floor(i / w)})`);
    if (decor[i] >= 0 && ground[i] < 0 && walls[i] < 0) add(where, `floating art at (${i % w},${Math.floor(i / w)})`);
    if (blocked.has(i) && !drawn(i) && !npcCells.has(i)) add(where, `invisible wall at (${i % w},${Math.floor(i / w)})`);
    if (decor[i] >= 0 && !KIND.has(decor[i])) add(where, `unknown tile ${decor[i]}`);
  }
  for (const n of m.npcs) {
    const i = at(n.x, n.y);
    const t = KIND.get(decor[i]);
    const seat = !!t && /^(chair_|office_chair|seat_)/.test(t.name);
    if (walls[i] >= 0 || (t?.kind === "block" && !seat)) add(where, `${n.id} stands in a wall or furniture at (${n.x},${n.y})`);
  }
  const solid = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h || walls[at(x, y)] >= 0 || blocked.has(at(x, y)) || npcCells.has(at(x, y));
  const seen = new Set([at(m.spawn.x, m.spawn.y)]);
  const todo = [[m.spawn.x, m.spawn.y]];
  if (solid(m.spawn.x, m.spawn.y) && !npcCells.has(at(m.spawn.x, m.spawn.y))) add(where, "the spawn is inside something solid");
  while (todo.length) {
    const [x, y] = todo.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!solid(nx, ny) && !seen.has(at(nx, ny))) {
        seen.add(at(nx, ny));
        todo.push([nx, ny]);
      }
    }
  }
  const near = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(at(x + dx, y + dy)));
  for (const n of m.npcs) if (!near(n.x, n.y)) add(where, `${n.id} can't be reached`);
  for (const p of m.props ?? []) {
    if (!seen.has(at(p.x, p.y)) && !near(p.x, p.y)) add(where, `note "${p.label}" can't be reached`);
    if (npcCells.has(at(p.x, p.y))) add(where, `note "${p.label}" is under a person`);
  }
  // Exits are doors in the wall: you walk into them, so a reachable tile must touch each one.
  for (const e of m.exits ?? []) if (!seen.has(at(e.x, e.y)) && !near(e.x, e.y)) add(where, `the way out to ${e.to} can't be reached`);
  if (clueCount != null && (m.props?.length ?? 0) !== clueCount) add(where, `${m.props?.length ?? 0} notes in the room, want ${clueCount}`);
  const cells = new Set((m.props ?? []).map((p) => at(p.x, p.y)));
  if (cells.size !== (m.props?.length ?? 0)) add(where, "two notes share a spot");
}

// ---------- run ----------
let dailyCount = 0;
const today = Date.parse(`${todayUtc()}T00:00:00Z`);
const dates = new Set(recentDailyDates());
for (let i = 0; i < DAYS; i++) dates.add(new Date(today + i * DAY).toISOString().slice(0, 10));
for (const d of dates) {
  const c = dailyCase(d);
  const where = `daily ${d} (${c.theme}, ${c.title})`;
  checkCase(where, c, null);
  try {
    checkMap(where, buildDailyRoom(c), c.clues.length);
  } catch (e) {
    add(where, `room failed to build: ${(e as Error).message}`);
  }
  dailyCount++;
}

let seasonalCount = 0;
for (const s of SEASONS) {
  s.caseDates.forEach((d) => {
    const c = dailyCase(d);
    const helper = seasonalHelper(d);
    const where = `${s.id} ${d} (${c.title})`;
    if (!c.date.startsWith("2000-") || c.capUsdc !== 0.5) add(where, "didn't resolve to a holiday case");
    if (!helper) add(where, "no co-signer");
    checkCase(where, c, helper);
    try {
      checkMap(where, buildDailyRoom(c, helper ? { id: helper.id, sprite: helper.sprite } : undefined), c.clues.length);
    } catch (e) {
      add(where, `room failed to build: ${(e as Error).message}`);
    }
    seasonalCount++;
  });
}

// The lobby on each holiday's first day (and one day with none open), with its dressing.
const realNow = Date.now;
const floors = [0, 1, 2, 3].map((floor) => ({
  floor, name: `Floor ${floor}`, description: "", vault: "", rule: null, balanceUsd: 1, employees: [], cleared: true, unlocked: true, bestMs: null, board: [],
}));
for (const iso of [...SEASONS.map((s) => s.opens), "2027-09-01"]) {
  Date.now = () => Date.parse(`${iso}T12:00:00Z`);
  try {
    checkMap(`lobby on ${iso}`, buildLobby(floors as never), null);
  } catch (e) {
    add(`lobby on ${iso}`, `failed to build: ${(e as Error).message}`);
  }
}
Date.now = realNow;

// Agent rule sheets: every {{variable}} must be one the server sends.
const session = readFileSync("server/game/session.ts", "utf8");
const sent = new Set([...session.matchAll(/^\s+([a-z_]+)(?::|,$)/gm)].map((m) => m[1])); // key: value, or shorthand key,
for (const sheet of ["daily", "helper"]) {
  const md = readFileSync(`agents/${sheet}.md`, "utf8") + readFileSync("agents/shared-rules.md", "utf8");
  for (const v of new Set([...md.matchAll(/{{\s*([a-z_]+)\s*}}/g)].map((m) => m[1])))
    if (!sent.has(v)) add(`agents/${sheet}.md`, `uses {{${v}}}, which server/game/session.ts never sends`);
}

if (problems.length) {
  // Group repeats so a pattern shows once with a count.
  const counts = new Map<string, number>();
  for (const p of problems) counts.set(p, (counts.get(p) ?? 0) + 1);
  for (const [p, n] of counts) console.error(`✗ ${p}${n > 1 ? ` (×${n})` : ""}`);
  console.error(`\n${problems.length} problem(s) across ${dailyCount} daily cases, ${seasonalCount} holiday layouts, the lobby and the agents`);
  process.exit(1);
}
console.log(`✓ ${dailyCount} daily cases, ${seasonalCount} holiday layouts, ${SEASONS.length + 1} lobbies and the agent sheets: no problems`);
