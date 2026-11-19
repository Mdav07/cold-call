"use client";

import { useEffect, useState, type ReactNode } from "react";
import { clock } from "../dialogue/parts";
import { setMuted, useMuted } from "./sound";
import { EarnedChip } from "@/app/play/earnings";

/** Run clock: counts from the first message until the run ends (then shows the final time). */
function RunClock({ startedAt, finalMs, compact = false }: { startedAt: number | null; finalMs: number | null; compact?: boolean }) {
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
  // Big and framed so it reads at a glance: muted until the first message, gold while it runs, green
  // once the run is over.
  const tone = finalMs != null ? "text-[var(--cc-ok,#6fbf73)]" : ticking ? "text-[var(--cc-accent)]" : "text-[var(--cc-muted)]";
  return (
    <span
      role="timer"
      aria-label={`Run time ${clock(ms)}`}
      title="Run timer: starts at your first message"
      className={`inline-flex items-baseline gap-1.5 border-2 border-[var(--cc-edge)] bg-[var(--cc-bg)] tabular-nums ${compact ? "px-1.5 py-0.5" : "px-2 py-1"} ${tone}`}
    >
      {!compact && <span className="text-[8px] text-[var(--cc-muted)]">TIME</span>}
      <span className={compact ? "text-[12px]" : "text-[13px] sm:text-sm"}>{clock(ms)}</span>
    </span>
  );
}

/** The HUD's buttons are small pixel text; this grows each one's tap area to about 40px without moving it. */
const HIT = "relative before:absolute before:-inset-x-1.5 before:-inset-y-3 before:content-['']";

/** Sound effects on/off (music has its own button) for the dialogue blips and choice ticks (remembered in this browser). */
function MuteToggle({ icon = false }: { icon?: boolean }) {
  const muted = useMuted();
  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      aria-pressed={muted}
      aria-label={muted ? "Sound effects off. Turn them on" : "Sound effects on. Turn them off"}
      title="Dialogue blips and menu sounds"
      className={`${HIT} text-[var(--cc-accent)]`}
    >
      {icon ? <SpeakerIcon muted={muted} /> : muted ? "SFX OFF" : "SFX ON"}
    </button>
  );
}

/** 10x10 pixel icons for the compact (docked) HUD. */
function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 10 10" width="14" height="14" aria-hidden shapeRendering="crispEdges" className="block">
      <path d="M1 4h2l3-3v8L3 6H1z" fill="currentColor" />
      {muted ? <path d="M7 3l3 4M10 3L7 7" stroke="currentColor" strokeWidth="1.2" /> : <path d="M7.5 3.5q1.5 1.5 0 3M8.5 2q3 3 0 6" stroke="currentColor" strokeWidth="1" fill="none" />}
    </svg>
  );
}
function RestartIcon() {
  return (
    <svg viewBox="0 0 10 10" width="14" height="14" aria-hidden className="block">
      <path d="M8 5a3 3 0 1 1-1-2.2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M6 1h3v3z" fill="currentColor" />
    </svg>
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
  onRestart,
  docked = false,
}: {
  floorName: string;
  startedAt: number | null;
  finalMs: number | null;
  vault: ReactNode;
  /** Leave through the elevator instead of a hard page jump. */
  onTower?: () => void;
  onCaseFile?: () => void;
  /** Start the level over (shown while a run is in progress). */
  onRestart?: () => void;
  /** On the handheld-console deck (phones held upright) instead of floating over the map. */
  docked?: boolean;
}) {
  // On the handheld-console deck: one slim row, icons for the buttons. The floor's name is printed under
  // the screen instead, and the word VAULT is dropped (the amount is green and needs no label).
  if (docked)
    return (
      <div className="pixel-frame flex w-full items-center justify-between gap-2 bg-[var(--cc-panel)] px-2.5 py-1.5 font-pixel text-[9px] leading-none text-[var(--cc-ink)] [&_.cc-vault-label]:hidden">
        <a
          href="/tower"
          onClick={(e) => {
            if (!onTower || e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            onTower();
          }}
          aria-label="Back to the tower"
          className={`${HIT} text-[11px] text-[var(--cc-accent)]`}
        >
          ◀
        </a>
        <RunClock startedAt={startedAt} finalMs={finalMs} compact />
        <EarnedChip />
        <span className="flex items-center gap-1.5">{vault}</span>
        {onCaseFile && (
          <button type="button" onClick={onCaseFile} className={`${HIT} text-[var(--cc-accent)]`} aria-label="Open the case file">
            FILE
          </button>
        )}
        {onRestart && (
          <button type="button" onClick={onRestart} className={`${HIT} text-[var(--cc-accent)]`} aria-label="Restart this level">
            <RestartIcon />
          </button>
        )}
        <MuteToggle icon />
      </div>
    );
  return (
    <div className={docked ? "w-full" : "pointer-events-none absolute left-0 top-0 z-10 p-3 sm:p-4"}>
      <div className={`pixel-frame pointer-events-auto flex ${docked ? "w-full justify-center" : "max-w-[calc(100vw-5rem)]"} flex-wrap items-center gap-x-3 gap-y-3 sm:gap-x-4 bg-[var(--cc-panel)]/95 px-3 py-2.5 font-pixel text-[10px] leading-none text-[var(--cc-ink)]`}>
        <a
          href="/tower"
          onClick={(e) => {
            if (!onTower || e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            onTower();
          }}
          className={`${HIT} text-[var(--cc-accent)] underline-offset-2 hover:underline`} title="Back to the tower">
          ◀ TOWER
        </a>
        {/* Phones: "Floor 1" only, so the HUD stays two lines and leaves the map visible. */}
        <span className="sm:hidden">{floorName.split(" · ")[0]}</span>
        <span className="hidden sm:inline">{floorName}</span>
        <RunClock startedAt={startedAt} finalMs={finalMs} />
        <EarnedChip />
        {vault}
        {onCaseFile && (
          <button type="button" onClick={onCaseFile} className={`${HIT} text-[var(--cc-accent)]`} title="Open the case file">
            <span className="sm:hidden">FILE</span>
            <span className="hidden sm:inline">CASE FILE</span>
          </button>
        )}
        {onRestart && (
          <button type="button" onClick={onRestart} className={`${HIT} text-[var(--cc-accent)]`} title="Start this level over">
            RESTART
          </button>
        )}
        <MuteToggle />
      </div>
    </div>
  );
}
