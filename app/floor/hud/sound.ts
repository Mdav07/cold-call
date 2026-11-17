"use client";

// Tiny UI sounds for the floors: typewriter blips and choice ticks, made with Web Audio (no files).
// One mute switch, remembered in localStorage, shared by every component through useMuted().

import { useSyncExternalStore } from "react";

const KEY = "cc-muted";
const listeners = new Set<() => void>();
let muted: boolean | null = null;

function read(): boolean {
  if (muted == null) {
    try {
      muted = localStorage.getItem(KEY) === "1";
    } catch {
      muted = false;
    }
  }
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(KEY, m ? "1" : "0");
  } catch {
    // private window or blocked storage: the switch still works for this page
  }
  listeners.forEach((l) => l());
}

export function useMuted(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => false,
  );
}

let ctx: AudioContext | null = null;

function tone(freq: number, ms: number, gain = 0.04, type: OscillatorType = "square", delayMs = 0) {
  if (read() || typeof window === "undefined") return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime + delayMs / 1000;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.02);
  } catch {
    // no Web Audio: stay silent
  }
}

/** One typewriter blip. `pitch` gives each speaker a voice (Hz). */
export const blip = (pitch = 440) => tone(pitch * (0.95 + Math.random() * 0.1), 35, 0.03);
/** The cursor moved to another choice. */
export const tick = () => tone(880, 25, 0.025);
/** A choice was confirmed. */
export const confirm = () => {
  tone(660, 45, 0.035);
  tone(990, 70, 0.035, "square", 50);
};

/** A stable pitch per speaker id, between 300 and 600 Hz. */
export function voicePitch(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 300 + (h % 300);
}

/** The elevator arrived. */
export const ding = () => {
  tone(1320, 400, 0.03, "sine");
  tone(1046, 600, 0.03, "sine", 180);
};

/** Evidence filed: a quick rising three-note chime (muted by the SFX switch). */
export const chime = () => {
  tone(784, 90, 0.03, "triangle");
  tone(988, 90, 0.03, "triangle", 90);
  tone(1319, 180, 0.03, "triangle", 180);
};
