"use client";

import { useEffect, useState, type ReactNode } from "react";
import { clock } from "../dialogue/parts";

/** Run clock: counts from the first message until the run ends (then shows the final time). */
function RunClock({ startedAt, finalMs }: { startedAt: number | null; finalMs: number | null }) {
  const [now, setNow] = useState(0);
  const ticking = startedAt != null && finalMs == null;
  useEffect(() => {
    if (!ticking) return;
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [ticking]);
  const ms = finalMs ?? (startedAt != null && now ? now - startedAt : 0);
  return <span title="Run timer: starts at your first message">RUN {clock(ms)}</span>;
}

/** Top-left HUD over the floor. `vault` is the server-rendered balance and Daily badge. */
export function Hud({
  floorName,
  startedAt,
  finalMs,
  vault,
}: {
  floorName: string;
  startedAt: number | null;
  finalMs: number | null;
  vault: ReactNode;
}) {
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-10 p-3 sm:p-4">
      <div className="pixel-frame pointer-events-auto flex flex-wrap items-center gap-x-4 gap-y-1 bg-[var(--cc-panel)]/95 px-3 py-2 font-pixel text-[10px] text-[var(--cc-ink)]">
        <a href="/tower" className="text-[var(--cc-accent)] underline-offset-2 hover:underline" title="Back to the tower">
          ◀ TOWER
        </a>
        <span>{floorName}</span>
        <RunClock startedAt={startedAt} finalMs={finalMs} />
        {vault}
      </div>
    </div>
  );
}
