"use client";

// Fixed music button: starts only on the first click (browsers block autoplay), then loops quietly.
// Preference is stored in localStorage so the choice survives navigation.

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "cc-music-on";

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

export function MusicToggle({ track }: { track: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setOn(readPref());
  }, []);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  // Swap the source when the track changes (e.g. different floor), keep playing if already on.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !started) return;
    const next = `/audio/${track}`;
    if (a.src.endsWith(next)) return;
    const wasPlaying = !a.paused;
    a.src = next;
    a.loop = true;
    a.volume = 0.25;
    if (wasPlaying && on) void a.play().catch(() => setOn(false));
  }, [track, started, on]);

  const ensureAudio = () => {
    if (!audioRef.current) {
      const a = new Audio(`/audio/${track}`);
      a.loop = true;
      a.volume = 0.25;
      audioRef.current = a;
      setStarted(true);
    }
    return audioRef.current;
  };

  const toggle = () => {
    const a = ensureAudio();
    // Prefer "is audio actually playing" over the remembered flag so a restored
    // "on" still needs a click to start (browsers block autoplay).
    if (on && !a.paused) {
      a.pause();
      setOn(false);
      writePref(false);
    } else {
      a.play()
        .then(() => {
          setOn(true);
          writePref(true);
        })
        .catch(() => {
          setOn(false);
          writePref(false);
        });
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="pixel-button fixed right-3 top-3 z-50 grid size-10 place-items-center !p-0 text-[var(--cc-edge)] sm:right-4 sm:top-4"
      aria-label={on ? "Mute music" : "Play music"}
      aria-pressed={on}
      title={on ? "Music on" : "Music off"}
    >
      <NoteIcon muted={!on} />
    </button>
  );
}
