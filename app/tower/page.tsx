import Link from "next/link";
import { Suspense } from "react";
import { signedInUserId } from "@/server/game/auth";
import { getDemoUserId } from "@/server/game/players";
import { getTower, type TowerFloor } from "@/server/game/tower";

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
  const floors = await getTower(userId);
  // The tower reads top-down: the executive suite first, the Pocket Branch at street level.
  return (
    <div className="flex flex-col gap-4">
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
