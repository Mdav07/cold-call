// Leaderboard (written by A for B, by agreement). Every player row is a breach the chain confirmed:
// the leaderboard view only includes runs whose TransferExecuted event the Stream stored.
// Rival crews (app/leaderboard/rivals.ts) are fictional, tagged as rivals, and only on the floor boards.
import Link from "next/link";
import { BackButton } from "@/app/ui/BackButton";
import { connection } from "next/server";
import { Suspense } from "react";
import company from "@/content/plumpurse/company.json";
import { db } from "@/server/chain/db";
import { contractFor } from "@/server/game/daily";
import { ladderFor, RIVALS_INTRO, type Rival } from "./rivals";

const FLOORS = [0, 1, 2, 3] as const;
const PER_FLOOR = 20;

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

const floorName = (n: number) => {
  const f = company.floors.find((x) => x.floor === n);
  if (n === 0) return f?.name ?? "Tutorial";
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

/** The rivals on this floor, slowest first, with the ones the fastest real hunter has already beaten ticked. */
function RivalLadder({ ladder, best }: { ladder: Rival[]; best: number | null }) {
  if (!ladder.length) return null;
  const beaten = (r: Rival) => best != null && best < r.duration_ms;
  const next = ladder.find((r) => !beaten(r));
  const count = ladder.filter(beaten).length;
  return (
    <div className="flex flex-col gap-2 border-2 border-[var(--cc-edge)] bg-[var(--cc-panel-2)] p-3">
      <p className="font-pixel text-[10px] text-[var(--cc-accent)]">Rival ladder</p>
      <ol className="flex flex-wrap items-center gap-1.5">
        {ladder.map((r, i) => (
          <li key={r.id} className="flex items-center gap-1.5">
            <span
              className="font-pixel border-2 px-1.5 py-1 text-[8px]"
              style={
                beaten(r)
                  ? { background: "var(--cc-panel)", color: "var(--cc-muted)", borderColor: r.crew.color }
                  : { background: r.crew.color, color: "#15141a", borderColor: "var(--cc-edge)" }
              }
              title={`${r.crew.label}: ${r.crew.name}${beaten(r) ? " (beaten)" : ""}`}
            >
              {beaten(r) && (
                <span aria-label="beaten" className="mr-1 font-sans text-[11px] font-bold" style={{ color: r.crew.color }}>
                  ✓
                </span>
              )}
              {r.name} {clock(r.duration_ms)}
            </span>
            {i < ladder.length - 1 && <span aria-hidden className="font-pixel text-[10px] text-[var(--cc-accent)]">▶</span>}
          </li>
        ))}
      </ol>
      <p className="text-xs text-[var(--cc-muted)]">
        {best == null
          ? `Nobody has cleared this floor yet. Start with ${ladder[0].name} (${clock(ladder[0].duration_ms)}).`
          : next
            ? `The fastest hunter has beaten ${count} of ${ladder.length}. Next up: ${next.name} of ${next.crew.name} (${clock(next.duration_ms)}).`
            : `${ladder[ladder.length - 1].name} has been beaten on this floor. The Black Ledger wants a rematch.`}
      </p>
    </div>
  );
}

async function Boards({ searchParams }: { searchParams: PageProps<"/leaderboard">["searchParams"] }) {
  await connection(); // today's contract depends on the current date, so render per request
  const { floor: raw, channel: rawChannel } = await searchParams;
  const floor = FLOORS.includes(Number(raw) as (typeof FLOORS)[number]) ? Number(raw) : 1;
  // Spec decision 19: a voice/chat filter. A run that used voice at all counts as voice.
  const channel = rawChannel === "voice" || rawChannel === "chat" ? rawChannel : "all";
  const href = (f: number, c: string) => `/leaderboard?floor=${f}${c === "all" ? "" : `&channel=${c}`}`;

  const [contract, board, streaks] = await Promise.all([
    contractFor(),
    db()
      .from("leaderboard")
      .select("user_id, display_name, floor, channel, duration_ms, tx_hash, daily_contract_id")
      .order("duration_ms")
      .limit(2000),
    db()
      .from("streaks")
      .select("user_id, current, longest, users(display_name)")
      .gt("longest", 0)
      .order("longest", { ascending: false })
      .limit(10),
  ]);
  const rows = ((board.data ?? []) as Row[]).filter((r) => channel === "all" || r.channel === channel);
  const daily = contract ? bestPerPlayer(rows.filter((r) => r.daily_contract_id === contract.id)).slice(0, 10) : [];
  const floorRows = bestPerPlayer(rows.filter((r) => r.floor === floor)).slice(0, PER_FLOOR);
  const ladder = ladderFor(floor).filter((r) => channel === "all" || r.channel === channel);
  const best = floorRows.length ? (floorRows[0].duration_ms as number) : null;

  return (
    <>
      <section aria-labelledby="daily" className="pixel-frame flex flex-col gap-3 bg-[var(--cc-panel)] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="daily" className="font-pixel text-xs text-[var(--cc-accent)]">
            Today&apos;s Daily Contract
          </h2>
          {contract && <span className="font-pixel text-[10px] text-[var(--cc-muted)]">{floorName(contract.floor)}</span>}
        </div>
        {contract ? (
          <>
            <p className="text-sm text-[var(--cc-muted)]">{contract.modifier}</p>
            <Board rows={daily} empty="Nobody has cleared today's contract yet." />
          </>
        ) : (
          <p className="text-sm text-[var(--cc-muted)]">No contract today.</p>
        )}
      </section>

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
              aria-current={n === floor ? "page" : undefined}
              className={n === floor ? "pixel-button" : `pixel-button ${OFF}`}
            >
              {n === 0 ? "Tutorial" : `Floor ${n}`}
            </Link>
          ))}
        </nav>
        <nav aria-label="Channel" className="flex flex-wrap items-center gap-2">
          {(["all", "voice", "chat"] as const).map((c) => (
            <Link
              key={c}
              href={href(floor, c)}
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
        <p className="font-pixel text-[10px] text-[var(--cc-muted)]">{floorName(floor)}</p>
        <RivalLadder ladder={ladder} best={best} />
        <Board rows={floorRows} rivals={ladder} empty="No breaches on this floor yet. Be the first." />
      </section>

      <section aria-labelledby="streaks" className="pixel-frame flex flex-col gap-3 bg-[var(--cc-panel)] p-4">
        <h2 id="streaks" className="font-pixel text-xs text-[var(--cc-accent)]">
          Longest streaks
        </h2>
        {streaks.data?.length ? (
          <ol className="flex flex-col gap-1 text-sm">
            {streaks.data.map((s, i) => {
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
          <p className="text-sm text-[var(--cc-muted)]">No streaks yet. Clear a Daily Contract to start one.</p>
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
