"use client";

// Fixed ♪ button: starts music only on the first click (browsers block autoplay), then loops quietly.
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
      className="pixel-button fixed right-3 top-3 z-50 grid size-9 place-items-center !p-0 text-sm sm:right-4 sm:top-4"
      aria-label={on ? "Mute music" : "Play music"}
      aria-pressed={on}
      title={on ? "Music on" : "Music off"}
    >
      {on ? "♪" : "♪̸"}
    </button>
  );
}
