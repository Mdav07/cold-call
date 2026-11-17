import Link from "next/link";
import { Suspense } from "react";
import { signedInUserId } from "@/server/game/auth";
import { getDemoUserId } from "@/server/game/players";
import { getTower, type TowerFloor } from "@/server/game/tower";
import { getDaily, type DailyState } from "@/server/game/daily";
import krystal from "@/content/plumpurse/krystal.json";
import { KrystalMemo } from "../play/KrystalMemo";

function Trail({ floors }: { floors: TowerFloor[] }) {
  const clues = krystal.clues as Record<string, { title: string; text: string }>;
  const cleared = (n: number) => floors.some((f) => f.floor === n && f.cleared);
  const found = [0, 1, 2, 3].filter(cleared).length;
  return (
    <section aria-labelledby="trail" className="pixel-frame flex flex-col gap-3 bg-[var(--cc-panel)] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="trail" className="font-pixel text-xs text-[var(--cc-accent)]">Krystal&apos;s trail</h2>
        <span className="font-pixel text-[10px] text-[var(--cc-muted)]">{found} / 4 notes found</span>
      </div>
      <ol className="flex flex-col gap-2 text-sm">
        {[0, 1, 2, 3].map((n) =>
          cleared(n) ? (
            <li key={n}>
              <span className="font-pixel text-[10px] text-[var(--cc-ink)]">{clues[n].title}</span>
              <p className="text-[var(--cc-muted)]">{clues[n].text}</p>
            </li>
          ) : (
            <li key={n} className="text-[var(--cc-muted)]">
              <span className="font-pixel text-[10px]">???</span> Clear {n === 0 ? "the Pocket Branch" : `Floor ${n}`} to find this note.
            </li>
          ),
        )}
      </ol>
      {cleared(3) && (
        <div className="mt-2 border-t-2 border-[var(--cc-edge)] pt-3">
          <KrystalMemo title="Krystal's last note" audio={krystal.ending.audio} text={krystal.ending.text} />
          <p className="mt-2 font-pixel text-[10px] text-[var(--cc-accent)]">{krystal.season_tease}</p>
        </div>
      )}
    </section>
  );
}

function DailyCard({ daily, floors }: { daily: DailyState; floors: TowerFloor[] }) {
  const c = daily.contract;
  const floorName = c ? floors.find((f) => f.floor === c.floor)?.name : null;
  return (
    <section aria-labelledby="daily" className="pixel-frame flex flex-col gap-2 bg-[var(--cc-panel)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="daily" className="font-pixel text-xs text-[var(--cc-accent)]">Daily Contract</h2>
        <span className="font-pixel text-[10px] text-[var(--cc-ink)]" title="Days in a row with a Daily Contract cleared">
          🔥 {daily.streak.current} day streak · best {daily.streak.longest}
        </span>
      </div>
      {c ? (
        <>
          <p className="text-sm text-[var(--cc-ink)]">
            Today: Floor {c.floor}
            {floorName ? ` · ${floorName}` : ""}. {c.modifier}
          </p>
          <p className="text-xs text-[var(--cc-muted)]">
            {daily.clearedToday
              ? "Cleared today. Come back tomorrow to keep the streak alive."
              : "Clear today's floor for the full bounty and +1 on your streak."}
          </p>
        </>
      ) : (
        <p className="text-sm text-[var(--cc-muted)]">No contract posted today.</p>
      )}
    </section>
  );
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function FloorCard({ f }: { f: TowerFloor }) {
  const status = f.cleared ? "CLEARED" : f.unlocked ? "OPEN" : "LOCKED";
  const tone = f.cleared ? "var(--cc-ok)" : f.unlocked ? "var(--cc-accent)" : "var(--cc-muted)";
  return (
    <section
      aria-labelledby={`floor-${f.floor}`}
      className={`pixel-frame flex flex-col gap-3 bg-[var(--cc-panel)] p-4 ${f.unlocked ? "" : "opacity-60"}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`floor-${f.floor}`} className="font-pixel text-xs text-[var(--cc-ink)]">
          {f.floor === 0 ? "Across the street" : `Floor ${f.floor}`} · {f.name}
        </h2>
        <span className="font-pixel text-[10px]" style={{ color: tone }}>
          {status}
        </span>
      </div>
      <p className="text-sm text-[var(--cc-muted)]">{f.description}</p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span>
          <span className="text-[var(--cc-muted)]">{f.vault} vault: </span>
          <span className="text-[var(--cc-ok)]">{f.balanceUsd == null ? "?" : `$${f.balanceUsd.toFixed(2)}`}</span>
        </span>
        {f.bestMs != null && (
          <span>
            <span className="text-[var(--cc-muted)]">Your best: </span>
            {clock(f.bestMs)}
          </span>
        )}
      </div>
      {f.rule && <p className="text-xs text-[var(--cc-muted)]">{f.rule}</p>}
      <div className="flex flex-wrap gap-2">
        {f.employees.map((e) =>
          e.playable && f.unlocked ? (
            <Link key={e.id} href={`/play/${e.id}`} className="pixel-button" title={e.title}>
              {e.name}
            </Link>
          ) : (
            <span key={e.id} className="pixel-button opacity-45" title={f.unlocked ? "Coming soon" : "Clear the floor below first"}>
              {e.name}
            </span>
          ),
        )}
      </div>
      {f.board.length > 0 && (
        <ol className="mt-1 text-xs text-[var(--cc-muted)]">
          {f.board.map((b, i) => (
            <li key={b.tx}>
              {i + 1}. {b.name} · {clock(b.ms)} · {b.channel === "voice" ? "☎ voice" : "✉ chat"} ·{" "}
              <a className="underline" href={`https://explorer.testnet.arc.io/tx/${b.tx}`} target="_blank" rel="noreferrer">
                proof
              </a>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

async function Floors() {
  const userId = (await signedInUserId()) ?? (process.env.SUPABASE_SERVICE_ROLE_KEY ? await getDemoUserId() : null);
  const [floors, daily] = await Promise.all([getTower(userId), getDaily(userId)]);
  // The tower reads top-down: the executive suite first, the Pocket Branch at street level.
  return (
    <div className="flex flex-col gap-4">
      <DailyCard daily={daily} floors={floors} />
      <Trail floors={floors} />
      {[...floors].reverse().map((f) => (
        <FloorCard key={f.floor} f={f} />
      ))}
    </div>
  );
}

export default function TowerPage() {
  return (
    <main className="cc-floor-1 mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <header className="pixel-frame flex flex-wrap items-center justify-between gap-2 bg-[var(--cc-panel)] px-4 py-3">
        <h1 className="font-pixel text-xs text-[var(--cc-accent)]">Plumpurse Tower</h1>
        <nav className="flex gap-4 text-sm">
          <Link className="underline" href="/casefile">
            Case file
          </Link>
          <Link className="underline" href="/leaderboard">
            Leaderboard
          </Link>
          <Link className="underline" href="/signin">
            Sign in
          </Link>
        </nav>
      </header>
      <Suspense
        fallback={<p className="font-pixel text-xs text-[var(--cc-muted)]">Checking the vaults…</p>}
      >
        <Floors />
      </Suspense>
    </main>
  );
}
