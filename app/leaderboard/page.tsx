// Leaderboard (written by A for B, by agreement). Every player row is a breach the chain confirmed:
// the leaderboard view only includes runs whose TransferExecuted event the Stream stored.
// Rival crews (app/leaderboard/rivals.ts) are fictional, tagged as rivals, and only on the floor boards.
import Link from "next/link";
import { BackButton } from "@/app/ui/BackButton";
import { connection } from "next/server";
import { Suspense } from "react";
import company from "@/content/plumpurse/company.json";
import { getDemoUserId, isPublicBoardName } from "@/server/game/players";
import { db } from "@/server/chain/db";
import { ladderFor, RIVALS_INTRO, type Rival } from "./rivals";
import { dailyBoard, streakOf } from "@/server/game/dailyBoard";
import { DAILY_FLOOR, dailyCase, todayUtc } from "@/shared/dailyCase";
import { SEASONS, currentSeason, isSeasonalDate, type Season } from "@/shared/seasonalCase";

const FLOORS = [0, 1, 2, 3] as const;
const PER_FLOOR = 20;

/** Season to show on the board: the one open now, else the most recent with a case. */
function boardSeason(): Season | null {
  return (
    currentSeason() ??
    SEASONS.filter((s) => s.case)
      .sort((a, b) => b.closes.localeCompare(a.closes))[0] ??
    null
  );
}

type Row = {
  user_id: string;
  display_name: string | null;
  floor: number;
  channel: string;
  duration_ms: number | null;
  tx_hash: string;
  daily_contract_id: string | null;
};

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Every paid breach, for the winnings board. Reads cracked_units (the agreed bounty) when the database
 * has that column; until its migration is applied, falls back to the paid amount alone.
 */
async function paidBreaches() {
  const q = (cols: string) => db().from("runs").select(cols).eq("outcome", "breach").not("payout_units", "is", null).limit(5000);
  const withCracked = await q("user_id, payout_units, cracked_units, users(display_name)");
  return withCracked.error ? q("user_id, payout_units, users(display_name)") : withCracked;
}

const floorName = (n: number) => {
  const f = company.floors.find((x) => x.floor === n);
  if (n === 0) return "Tutorial";
  return `Floor ${n}${f ? ` · ${f.name}` : ""}`;
};

/** Best time per player: the board ranks players, not runs. */
function bestPerPlayer(rows: Row[]): Row[] {
  const best = new Map<string, Row>();
  for (const r of rows) {
    if (r.duration_ms == null) continue;
    const b = best.get(r.user_id);
    if (!b || r.duration_ms < (b.duration_ms as number)) best.set(r.user_id, r);
  }
  return [...best.values()].sort((a, b) => (a.duration_ms as number) - (b.duration_ms as number));
}

type Entry = { kind: "player"; row: Row } | { kind: "rival"; rival: Rival };

const entryMs = (e: Entry) => (e.kind === "player" ? (e.row.duration_ms as number) : e.rival.duration_ms);

/** A small crew badge in the crew's colour. */
function CrewTag({ rival }: { rival: Rival }) {
  return (
    <span
      title={`${rival.crew.name}: ${rival.crew.blurb}`}
      className="font-pixel shrink-0 border-2 border-[var(--cc-edge)] px-1.5 py-0.5 text-[8px] text-[#15141a]"
      style={{ background: rival.crew.color }}
    >
      {rival.boss ? "Boss" : "Rival"} · {rival.crew.name}
    </span>
  );
}

function Board({ rows, rivals = [], empty }: { rows: Row[]; rivals?: Rival[]; empty: string }) {
  const entries: Entry[] = [
    ...rows.map((row) => ({ kind: "player" as const, row })),
    ...rivals.map((rival) => ({ kind: "rival" as const, rival })),
  ].sort((a, b) => entryMs(a) - entryMs(b));
  if (!entries.length) return <p className="text-sm text-[var(--cc-muted)]">{empty}</p>;
  return (
    <ol className="flex flex-col gap-1 text-sm">
      {entries.map((e, i) =>
        e.kind === "player" ? (
          <li key={e.row.tx_hash} className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-pixel w-6 text-[10px] text-[var(--cc-accent)]">{i + 1}.</span>
            <span className="min-w-0 flex-1 truncate font-semibold">{e.row.display_name ?? "Anonymous hunter"}</span>
            <span className="tabular-nums">{clock(e.row.duration_ms as number)}</span>
            <span className="w-16 text-[var(--cc-muted)]">{e.row.channel === "voice" ? "☎ voice" : "✉ chat"}</span>
          </li>
        ) : (
          <li key={e.rival.id} className="flex flex-wrap items-center gap-x-3 text-[var(--cc-muted)]">
            <span className="font-pixel w-6 text-[10px]">{i + 1}.</span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate">{e.rival.name}</span>
              <CrewTag rival={e.rival} />
            </span>
            <span className="tabular-nums">{clock(e.rival.duration_ms)}</span>
            <span className="w-16">{e.rival.channel === "voice" ? "☎ voice" : "✉ chat"}</span>
          </li>
        ),
      )}
    </ol>
  );
}

async function Boards({ searchParams }: { searchParams: PageProps<"/leaderboard">["searchParams"] }) {
  await connection(); // today's case depends on the current date, so render per request
  const { floor: raw, channel: rawChannel } = await searchParams;
  // "daily" / "seasonal": case boards with no rival crews (Daily uses today; Seasonal uses its reserved date).
  const isDaily = raw === "daily";
  const isSeasonal = raw === "seasonal";
  const floor = FLOORS.includes(Number(raw) as (typeof FLOORS)[number]) ? Number(raw) : 1;
  // Spec decision 19: a voice/chat filter. A run that used voice at all counts as voice.
  const channel = rawChannel === "voice" || rawChannel === "chat" ? rawChannel : "all";
  const href = (f: number | "daily" | "seasonal", c: string) =>
    `/leaderboard?floor=${f}${c === "all" ? "" : `&channel=${c}`}`;
  const tab: number | "daily" | "seasonal" = isDaily ? "daily" : isSeasonal ? "seasonal" : floor;

  const today = dailyCase(todayUtc());
  const season = boardSeason();
  const seasonCase = season?.case ?? null;
  const [board, streaks, todaysBoard, seasonalBoardRows, paidRuns, demoId] = await Promise.all([
    db()
      .from("leaderboard")
      .select("user_id, display_name, floor, channel, duration_ms, tx_hash, daily_contract_id")
      .order("duration_ms")
      .limit(2000),
    // Daily Case streaks: every real (non-practice) Daily clear, grouped per player below.
    db()
      .from("runs")
      .select("user_id, daily_date, users(display_name)")
      .eq("floor", DAILY_FLOOR)
      .eq("outcome", "breach")
      .eq("practice", false)
      .not("daily_date", "is", null)
      .limit(5000),
    isDaily ? dailyBoard(today.date, PER_FLOOR) : Promise.resolve([]),
    // Seasonal cases share the Daily floor; rows are keyed by the season's reserved caseDate.
    isSeasonal && season ? dailyBoard(season.caseDate, PER_FLOOR) : Promise.resolve([]),
    // Winnings: every paid breach (testnet dollars), summed per player below.
    paidBreaches(),
    getDemoUserId().catch(() => null),
  ]);
  // Top earners: total bounty per signed-in player. Guests can't keep winnings, so they aren't listed.
  type PaidRun = {
    user_id: string;
    payout_units: string | number | null;
    cracked_units?: string | number | null;
    users: { display_name: string | null } | { display_name: string | null }[] | null;
  };
  const earners = new Map<string, { name: string; units: number; clears: number }>();
  for (const r of (paidRuns.data ?? []) as unknown as PaidRun[]) {
    if (!r.user_id || r.user_id === demoId) continue;
    const u = Array.isArray(r.users) ? r.users[0] : r.users;
    if (!isPublicBoardName(u?.display_name)) continue;
    const e = earners.get(r.user_id) ?? { name: u!.display_name as string, units: 0, clears: 0 };
    // What the employee agreed to ("cracked"), or what the chain paid where that isn't recorded.
    e.units += Number(r.cracked_units ?? r.payout_units ?? 0);
    e.clears += 1;
    earners.set(r.user_id, e);
  }
  const topEarners = [...earners.values()].sort((a, b) => b.units - a.units).slice(0, 10);
  // The shared guest account isn't a player: keep it off the streaks board too.
  type DailyRow = { user_id: string; daily_date: string; users: { display_name: string | null } | { display_name: string | null }[] | null };
  const dailyDays = new Map<string, { name: string | null; days: Set<string> }>();
  for (const r of (streaks.data ?? []) as DailyRow[]) {
    if (!r.user_id || r.user_id === demoId || isSeasonalDate(r.daily_date)) continue;
    const u = Array.isArray(r.users) ? r.users[0] : r.users;
    if (!isPublicBoardName(u?.display_name)) continue;
    const e = dailyDays.get(r.user_id) ?? { name: u!.display_name as string, days: new Set<string>() };
    e.days.add(r.daily_date);
    dailyDays.set(r.user_id, e);
  }
  const streakRows = [...dailyDays.entries()]
    .map(([user_id, e]) => ({ user_id, users: { display_name: e.name }, longest: streakOf(e.days, todayUtc()).best }))
    .filter((r) => r.longest > 0)
    .sort((a, b) => b.longest - a.longest)
    .slice(0, 10);
  // Case boards' rows, in the floor boards' shape (one per player, fastest first).
  const toCaseRows = (source: typeof todaysBoard): Row[] =>
    source
      .filter((r) => channel === "all" || r.channel === channel)
      .map((r, i) => ({
        user_id: `${r.name}-${i}`,
        display_name: r.name,
        floor: DAILY_FLOOR,
        channel: r.channel,
        duration_ms: r.ms,
        tx_hash: r.tx,
        daily_contract_id: null,
      }));
  const dailyRows = toCaseRows(todaysBoard);
  const seasonalRows = toCaseRows(seasonalBoardRows);
  // Shared guest account ("Demo Hunter") isn't a real player — keep it off every board.
  const rows = ((board.data ?? []) as Row[]).filter(
    (r) => r.user_id !== demoId && isPublicBoardName(r.display_name) && (channel === "all" || r.channel === channel),
  );
  const floorRows = bestPerPlayer(rows.filter((r) => r.floor === floor)).slice(0, PER_FLOOR);
  const ladder = ladderFor(floor).filter((r) => channel === "all" || r.channel === channel);
  const seasonOpen = !!currentSeason();

  return (
    <>
      <section aria-labelledby="floors" className="pixel-frame flex flex-col gap-3 bg-[var(--cc-panel)] p-4">
        <h2 id="floors" className="font-pixel text-xs text-[var(--cc-accent)]">
          Fastest breaches
        </h2>
        <nav aria-label="Floor" className="flex flex-wrap gap-2">
          {FLOORS.map((n) => (
            <Link
              key={n}
              href={href(n, channel)}
              replace
              scroll={false}
              aria-current={n === tab ? "page" : undefined}
              className={n === tab ? "pixel-button" : `pixel-button ${OFF}`}
            >
              {n === 0 ? "Tutorial" : `Floor ${n}`}
            </Link>
          ))}
          <Link
            href={href("daily", channel)}
            replace
            scroll={false}
            aria-current={isDaily ? "page" : undefined}
            className={isDaily ? "pixel-button" : `pixel-button ${OFF}`}
          >
            Daily Case
          </Link>
          <Link
            href={href("seasonal", channel)}
            replace
            scroll={false}
            aria-current={isSeasonal ? "page" : undefined}
            className={isSeasonal ? "pixel-button" : `pixel-button ${OFF}`}
          >
            {season?.name ?? "Seasonal"}
          </Link>
        </nav>
        <nav aria-label="Channel" className="flex flex-wrap items-center gap-2">
          {(["all", "voice", "chat"] as const).map((c) => (
            <Link
              key={c}
              href={href(tab, c)}
              replace
              scroll={false}
              aria-current={c === channel ? "page" : undefined}
              className={`border-2 border-[var(--cc-edge)] px-2.5 py-1.5 font-pixel text-[9px] ${
                c === channel ? "bg-[var(--cc-ink)] text-[var(--cc-edge)]" : "bg-[var(--cc-panel-2)] text-[var(--cc-ink)] hover:bg-[var(--cc-portrait)]"
              }`}
            >
              {c === "all" ? "All" : c === "voice" ? "☎ Voice" : "✉ Chat"}
            </Link>
          ))}
        </nav>
        {isDaily ? (
          <>
            <div className="flex flex-col gap-1">
              <p className="font-pixel text-[10px] text-[var(--cc-accent)]">
                Daily Case · {today.title}
              </p>
              <p className="font-pixel text-[9px] leading-relaxed text-[var(--cc-muted)]">
                {today.date} · {today.employee.name}, {today.employee.title.toLowerCase()} · {today.place}
              </p>
            </div>
            <Board rows={dailyRows} empty="Nobody has cracked today's case yet. Be the first." />
            <Link href="/daily" className="pixel-button self-start">
              Play today&apos;s case ▶
            </Link>
          </>
        ) : isSeasonal ? (
          season && seasonCase ? (
            <>
              <div className="flex flex-col gap-1">
                <p className="font-pixel text-[10px] text-[var(--cc-accent)]">
                  {season.name} · {seasonCase.title}
                </p>
                <p className="font-pixel text-[9px] leading-relaxed text-[var(--cc-muted)]">
                  {seasonCase.employee.name}, {seasonCase.employee.title.toLowerCase()}
                  {season.helper ? ` + ${season.helper.firstName}` : ""} · {seasonCase.place}
                  {seasonOpen ? "" : " · closed"}
                </p>
              </div>
              <Board
                rows={seasonalRows}
                empty={`Nobody has cracked the ${season.name} case yet. Be the first.`}
              />
              {seasonOpen ? (
                <Link href="/seasonal" className="pixel-button self-start">
                  Play the {season.name} case ▶
                </Link>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-[var(--cc-muted)]">No seasonal case on the board yet.</p>
          )
        ) : (
          <>
            <p className="font-pixel text-[10px] text-[var(--cc-muted)]">{floorName(floor)}</p>
            <Board rows={floorRows} rivals={ladder} empty="No breaches on this floor yet. Be the first." />
          </>
        )}
      </section>

      <section aria-labelledby="earners" className="pixel-frame flex flex-col gap-3 bg-[var(--cc-panel)] p-4">
        <h2 id="earners" className="font-pixel text-xs text-[var(--cc-accent)]">
          Top earners
        </h2>
        {topEarners.length ? (
          <ol className="flex flex-col gap-1.5">
            {topEarners.map((e, i) => (
              <li key={`${e.name}-${i}`} className="flex items-center gap-3 border-2 border-[var(--cc-edge)] bg-[var(--cc-panel-2)] px-3 py-2">
                <span className="w-5 font-pixel text-[10px] text-[var(--cc-muted)]">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{e.name}</span>
                <span className="text-xs text-[var(--cc-muted)]">
                  {e.clears} {e.clears === 1 ? "breach" : "breaches"}
                </span>
                <span className="font-pixel text-[10px] text-[var(--cc-ok)]">${(e.units / 1_000_000).toFixed(2)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-[var(--cc-muted)]">No banked winnings yet. Sign in and breach a vault to get on the board.</p>
        )}
        <p className="text-xs text-[var(--cc-muted)]">Total bounty banked by signed-in hunters. Guests can play every floor, but only signed-in hunters keep their winnings.</p>
      </section>

      <section aria-labelledby="streaks" className="pixel-frame flex flex-col gap-3 bg-[var(--cc-panel)] p-4">
        <h2 id="streaks" className="font-pixel text-xs text-[var(--cc-accent)]">
          Longest Daily streaks
        </h2>
        {streakRows.length ? (
          <ol className="flex flex-col gap-1 text-sm">
            {streakRows.map((s, i) => {
              const u = s.users as unknown as { display_name: string | null } | null;
              return (
                <li key={s.user_id} className="flex items-baseline gap-x-3">
                  <span className="font-pixel w-6 text-[10px] text-[var(--cc-accent)]">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate">{u?.display_name ?? "Anonymous hunter"}</span>
                  <span className="tabular-nums">
                    {s.longest} day{s.longest === 1 ? "" : "s"}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-[var(--cc-muted)]">No streaks yet. Clear the Daily Case to start one.</p>
        )}
      </section>
    </>
  );
}

/** A filter button that is not selected: solid and readable rather than faded. */
const OFF = "!bg-[var(--cc-panel-2)] !text-[var(--cc-ink)] hover:!bg-[var(--cc-portrait)]";

export default function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  return (
    <main className="cc-floor-1 mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <header className="pixel-frame flex items-center gap-3 bg-[var(--cc-panel)] px-3 py-2">
        <BackButton />
        <h1 className="font-pixel text-xs text-[var(--cc-accent)]">Leaderboard</h1>
      </header>
      <p className="text-xs text-[var(--cc-muted)]">
        The clock runs from your first message until the vault pays you. {RIVALS_INTRO}
      </p>
      <Suspense fallback={<p className="font-pixel text-xs text-[var(--cc-muted)]">Reading the board…</p>}>
        <Boards searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
