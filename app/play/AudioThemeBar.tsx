"use client";

// Top-right cluster: Music, SFX, and (when a season is open) Theme. Same vein of ambient controls.
// Music reuses the module player in MusicToggle; SFX reuses the HUD mute switch; Theme swaps the
// seasonal lobby (holiday door + harvest dressing + leaves) for the original Tutorial/Daily lobby.

import { useClientValue } from "@/app/play/clientHooks";
import { MusicToggle } from "@/app/play/MusicToggle";
import { setMuted, useMuted } from "@/app/floor/hud/sound";
import { currentSeason } from "@/shared/seasonalCase";
import { setSeasonTheme, useSeasonTheme } from "@/app/play/seasonTheme";

function SfxButton() {
  const muted = useMuted();
  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      className="pixel-button grid size-10 place-items-center !p-0 text-[var(--cc-edge)]"
      aria-label={muted ? "Sound effects off. Turn them on" : "Sound effects on. Turn them off"}
      aria-pressed={!muted}
      title={muted ? "SFX off" : "SFX on"}
    >
      <SpeakerIcon muted={muted} />
    </button>
  );
}

function ThemeButton() {
  const on = useSeasonTheme();
  // Date.now() is client-only (prerender must not call currentSeason).
  const seasonOpen = useClientValue(() => !!currentSeason(), false);
  if (!seasonOpen) return null;
  return (
    <button
      type="button"
      onClick={() => setSeasonTheme(!on)}
      className="pixel-button grid size-10 place-items-center !p-0 text-[var(--cc-edge)]"
      aria-label={on ? "Seasonal décor on. Turn off leaves and harvest dressing" : "Seasonal décor off. Turn on leaves and harvest dressing"}
      aria-pressed={on}
      title={on ? "Seasonal décor on" : "Seasonal décor off"}
    >
      <LeafIcon muted={!on} />
    </button>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden className="block">
      <g opacity={muted ? 0.45 : 1}>
        <path d="M2 6h3l4-4v12L5 10H2z" fill="currentColor" />
        {!muted && (
          <>
            <path d="M11 5.5q2 2.5 0 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M12.5 3.5q3.5 4.5 0 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </>
        )}
      </g>
      {muted && <path d="M3 4 L13 14 M4 3 L14 13" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />}
    </svg>
  );
}

function LeafIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden className="block" shapeRendering="crispEdges">
      <g opacity={muted ? 0.45 : 1}>
        <rect x="7" y="2" width="2" height="2" fill="currentColor" />
        <rect x="5" y="4" width="6" height="2" fill="currentColor" />
        <rect x="4" y="6" width="8" height="2" fill="currentColor" />
        <rect x="5" y="8" width="6" height="2" fill="currentColor" />
        <rect x="7" y="10" width="2" height="4" fill="currentColor" />
      </g>
      {muted && <path d="M3 4 L13 14 M4 3 L14 13" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />}
    </svg>
  );
}

/** Fixed top-right bar: music (inline), SFX, and seasonal theme when available. */
export function AudioThemeBar({ track }: { track: string }) {
  return (
    <div className="fixed right-3 top-3 z-50 flex items-center gap-1.5 sm:right-4 sm:top-4">
      <MusicToggle track={track} embedded />
      <SfxButton />
      <ThemeButton />
    </div>
  );
}
