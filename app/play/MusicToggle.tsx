"use client";

// Fixed music button. One music player for the whole app (module state), so moving from the lobby to a
// level keeps one source of truth: the button shows whether music is actually playing, never just the
// remembered wish. Each page says which track it wants; the player swaps tracks and keeps playing.
// Browsers block autoplay: on a fresh page load a remembered "on" tries to play, and if the browser
// refuses, the button shows off until the player clicks it.

import { useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "cc-music-on";
const VOLUME = 0.25;

function readPref(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writePref(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    /* private mode / blocked storage */
  }
}

// ---------- the one player ----------

let audio: HTMLAudioElement | null = null;
let playing = false;
let mounted = 0; // toggles on screen; the music stops when the last one goes
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function player(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.volume = VOLUME;
    audio.addEventListener("play", () => {
      playing = true;
      emit();
    });
    audio.addEventListener("pause", () => {
      playing = false;
      emit();
    });
  }
  return audio;
}

function setTrack(track: string) {
  const a = player();
  const src = `/audio/${track}`;
  if (a.src.endsWith(src)) return;
  a.src = src;
}

function tryPlay() {
  // A refusal (autoplay) leaves `playing` false, so the button says off: it never lies.
  void player()
    .play()
    .catch(() => {
      playing = false;
      emit();
    });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Pixel note drawn in the button box so it stays centred (♪̸ was optically off). */
function NoteIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden className="block">
      <g opacity={muted ? 0.45 : 1}>
        <rect x="9" y="2" width="2" height="9" fill="currentColor" />
        <rect x="11" y="2" width="3" height="2" fill="currentColor" />
        <rect x="12" y="4" width="2" height="2" fill="currentColor" />
        <rect x="4" y="9" width="7" height="5" fill="currentColor" />
        <rect x="3" y="10" width="1" height="3" fill="currentColor" />
        <rect x="11" y="10" width="1" height="3" fill="currentColor" />
      </g>
      {muted && <path d="M3 4 L13 14 M4 3 L14 13" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />}
    </svg>
  );
}

/** @param embedded Inside AudioThemeBar (no fixed positioning). */
export function MusicToggle({ track, embedded = false }: { track: string; embedded?: boolean }) {
  const on = useSyncExternalStore(subscribe, () => playing, () => false);

  // This page's track. If music is playing or remembered on, keep it going across the move.
  useEffect(() => {
    mounted++;
    const wasPlaying = playing;
    setTrack(track);
    if (wasPlaying || readPref()) tryPlay();
    return () => {
      mounted--;
      // Moving between pages mounts the next toggle right after this one goes; only stop when no page
      // shows a toggle any more.
      queueMicrotask(() => {
        if (mounted === 0) audio?.pause();
      });
    };
  }, [track]);

  const toggle = () => {
    if (playing) {
      player().pause();
      writePref(false);
    } else {
      setTrack(track);
      writePref(true);
      tryPlay();
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={
        embedded
          ? "pixel-button grid size-10 place-items-center !p-0 text-[var(--cc-edge)]"
          : "pixel-button fixed right-3 top-3 z-50 grid size-10 place-items-center !p-0 text-[var(--cc-edge)] sm:right-4 sm:top-4"
      }
      aria-label={on ? "Mute music" : "Play music"}
      aria-pressed={on}
      title={on ? "Music on" : "Music off"}
    >
      <NoteIcon muted={!on} />
    </button>
  );
}
