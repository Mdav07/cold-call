"use client";

import { useEffect, useState, type ReactNode } from "react";
import { clock } from "../dialogue/parts";
import { setMuted, useMuted } from "./sound";

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

/** Sound effects on/off (music has its own button) for the dialogue blips and choice ticks (remembered in this browser). */
function MuteToggle() {
  const muted = useMuted();
  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      aria-pressed={muted}
      aria-label={muted ? "Sound effects off. Turn them on" : "Sound effects on. Turn them off"}
      title="Dialogue blips and menu sounds"
      className="text-[var(--cc-accent)]"
    >
      {muted ? "SFX OFF" : "SFX ON"}
    </button>
  );
}

/** Top-left HUD over the floor. `vault` is the server-rendered balance and Daily badge. */
export function Hud({
  floorName,
  startedAt,
  finalMs,
  vault,
  onTower,
  onCaseFile,
}: {
  floorName: string;
  startedAt: number | null;
  finalMs: number | null;
  vault: ReactNode;
  /** Leave through the elevator instead of a hard page jump. */
  onTower?: () => void;
  onCaseFile?: () => void;
}) {
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-10 p-3 sm:p-4">
      <div className="pixel-frame pointer-events-auto flex max-w-[calc(100vw-5rem)] flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-4 bg-[var(--cc-panel)]/95 px-3 py-2 font-pixel text-[10px] text-[var(--cc-ink)]">
        <a
          href="/tower"
          onClick={(e) => {
            if (!onTower || e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            onTower();
          }}
          className="text-[var(--cc-accent)] underline-offset-2 hover:underline" title="Back to the tower">
          ◀ TOWER
        </a>
        {/* Phones: "Floor 1" only, so the HUD stays two lines and leaves the map visible. */}
        <span className="sm:hidden">{floorName.split(" · ")[0]}</span>
        <span className="hidden sm:inline">{floorName}</span>
        <RunClock startedAt={startedAt} finalMs={finalMs} />
        {vault}
        {onCaseFile && (
          <button type="button" onClick={onCaseFile} className="text-[var(--cc-accent)]" title="Open the case file">
            <span className="sm:hidden">FILE</span>
            <span className="hidden sm:inline">CASE FILE</span>
          </button>
        )}
        <MuteToggle />
      </div>
    </div>
  );
}
