// Leaderboard (written by A for B, by agreement). Every row is a breach the chain confirmed:
// the leaderboard view only includes runs whose TransferExecuted event the Stream stored.
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import company from "@/content/plumpurse/company.json";
import { db } from "@/server/chain/db";
import { contractFor } from "@/server/game/daily";

const EXPLORER = "https://explorer.testnet.arc.io/tx/";
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

function Board({ rows, empty }: { rows: Row[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-[var(--cc-muted)]">{empty}</p>;
  return (
    <ol className="flex flex-col gap-1 text-sm">
      {rows.map((r, i) => (
        <li key={r.tx_hash} className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-pixel w-6 text-[10px] text-[var(--cc-accent)]">{i + 1}.</span>
          <span className="min-w-0 flex-1 truncate">{r.display_name ?? "Anonymous hunter"}</span>
          <span className="tabular-nums">{clock(r.duration_ms as number)}</span>
          <span className="w-16 text-[var(--cc-muted)]">{r.channel === "voice" ? "☎ voice" : "✉ chat"}</span>
          <a className="underline" href={`${EXPLORER}${r.tx_hash}`} target="_blank" rel="noreferrer">
            proof
          </a>
        </li>
      ))}
    </ol>
  );
}

async function Boards({ searchParams }: { searchParams: PageProps<"/leaderboard">["searchParams"] }) {
  await connection(); // today's contract depends on the current date, so render per request
  const { floor: raw } = await searchParams;
  const floor = FLOORS.includes(Number(raw) as (typeof FLOORS)[number]) ? Number(raw) : 1;

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
  const rows = (board.data ?? []) as Row[];
  const daily = contract ? bestPerPlayer(rows.filter((r) => r.daily_contract_id === contract.id)).slice(0, 10) : [];
  const floorRows = bestPerPlayer(rows.filter((r) => r.floor === floor)).slice(0, PER_FLOOR);

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
              href={`/leaderboard?floor=${n}`}
              aria-current={n === floor ? "page" : undefined}
              className={`pixel-button ${n === floor ? "" : "opacity-60"}`}
            >
              {n === 0 ? "Tutorial" : `Floor ${n}`}
            </Link>
          ))}
        </nav>
        <p className="font-pixel text-[10px] text-[var(--cc-muted)]">{floorName(floor)}</p>
        <Board rows={floorRows} empty="No breaches on this floor yet. Be the first." />
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

export default function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  return (
    <main className="cc-floor-1 mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <header className="pixel-frame flex flex-wrap items-center justify-between gap-2 bg-[var(--cc-panel)] px-4 py-3">
        <h1 className="font-pixel text-xs text-[var(--cc-accent)]">Leaderboard</h1>
        <nav className="flex gap-4 text-sm">
          <Link className="underline" href="/tower">
            Tower
          </Link>
        </nav>
      </header>
      <p className="text-xs text-[var(--cc-muted)]">
        Every time is from a real transfer on Arc testnet. The clock stops at the block that paid you.
      </p>
      <Suspense fallback={<p className="font-pixel text-xs text-[var(--cc-muted)]">Reading the chain…</p>}>
        <Boards searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
