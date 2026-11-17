"use client";

// Full-screen result after a run ends: the breach (alarm, PA announcer, bounty receipt, debrief)
// or the lockout (Null's taunt, the lesson). Audio is pre-generated with ElevenLabs into
// public/audio by agents/generate-audio.ts.

import { useEffect, useRef } from "react";
import debriefs from "@/content/plumpurse/debriefs.json";
import krystal from "@/content/plumpurse/krystal.json";
import type { RunState } from "./useRunState";

type Debrief = {
  title: string;
  real_world: string;
  patch: string;
  lesson: string;
  source?: { label: string; url: string };
};

const EXPLORER = "https://explorer.testnet.arc.io/tx/";

function playSequence(files: string[]) {
  const clips = files.map((f) => new Audio(`/audio/${f}`));
  clips.forEach((clip, i) => {
    if (i + 1 < clips.length) clip.onended = () => void clips[i + 1].play().catch(() => {});
  });
  // Autoplay is allowed: the player already clicked to start the call.
  clips[0]?.play().catch(() => {});
  return () => clips.forEach((c) => c.pause());
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function OutcomeOverlay({
  state,
  employeeName,
  onRetry,
  onClose,
}: {
  state: RunState;
  employeeName: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  const run = state.run;
  const outcome = run?.outcome;
  const played = useRef(false);

  useEffect(() => {
    if (played.current || !outcome) return;
    played.current = true;
    if (outcome === "breach") return playSequence(["breach-alarm.mp3", "breach-announcer.mp3"]);
    if (outcome === "lockout") return playSequence(["lockout-null.mp3"]);
  }, [outcome]);

  if (!run || (outcome !== "breach" && outcome !== "lockout")) return null;
  const debrief = (debriefs.floors as Record<string, Debrief>)[String(run.floor)];
  const breach = outcome === "breach";
  const paid = run.payout_units != null ? Number(run.payout_units) / 1_000_000 : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="outcome-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div
        className={`pixel-frame w-full max-w-xl bg-[var(--cc-panel)] p-6 ${breach ? "cc-alarm" : ""}`}
        style={{ borderColor: breach ? "var(--cc-danger)" : "var(--cc-edge)" }}
      >
        <p id="outcome-title" className="font-pixel text-lg text-[var(--cc-danger)]">
          {breach ? "⚠ VAULT BREACHED" : "LOCKED OUT"}
        </p>

        {breach ? (
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="font-pixel text-[10px] text-[var(--cc-muted)]">Bounty</p>
              <p className="text-xl text-[var(--cc-ok)]">{paid != null ? `$${paid.toFixed(2)}` : "…"}</p>
            </div>
            <div>
              <p className="font-pixel text-[10px] text-[var(--cc-muted)]">Time</p>
              <p className="text-xl">{run.duration_ms != null ? clock(run.duration_ms) : "…"}</p>
            </div>
            {run.tx_hash && (
              <a
                className="col-span-2 underline text-[var(--cc-accent)]"
                href={`${EXPLORER}${run.tx_hash}`}
                target="_blank"
                rel="noreferrer"
              >
                Proof of heist (on-chain receipt) ↗
              </a>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--cc-ink)]">
            {employeeName} hung up and warned the floor. Null and the Black Ledger got in first.
            {state.reason && <span className="block mt-2 text-[var(--cc-muted)]">What gave you away: {state.reason.text}</span>}
          </p>
        )}

        {breach && (krystal.clues as Record<string, { title: string; text: string }>)[String(run.floor)] && (
          <div className="mt-5 border-t-2 border-[var(--cc-edge)] pt-4 text-sm">
            <p className="font-pixel text-xs text-[var(--cc-accent)]">
              New note on Krystal&apos;s trail: {(krystal.clues as Record<string, { title: string }>)[String(run.floor)].title}
            </p>
            <p className="mt-2">{(krystal.clues as Record<string, { text: string }>)[String(run.floor)].text}</p>
            {run.floor === 3 && <p className="mt-2 text-[var(--cc-muted)]">Open the tower to read it.</p>}
          </div>
        )}

        {debrief && (
          <div className="mt-5 border-t-2 border-[var(--cc-edge)] pt-4 text-sm leading-relaxed">
            <p className="font-pixel text-xs text-[var(--cc-accent)]">{breach ? `Debrief: ${debrief.title}` : "Lesson"}</p>
            {breach ? (
              <>
                <p className="mt-2">{debrief.real_world}</p>
                <p className="mt-2 text-[var(--cc-muted)]">Patch notes: {debrief.patch}</p>
                {debrief.source && (
                  <a className="mt-2 block text-xs underline text-[var(--cc-muted)]" href={debrief.source.url} target="_blank" rel="noreferrer">
                    Source: {debrief.source.label}
                  </a>
                )}
              </>
            ) : (
              <p className="mt-2">{debrief.lesson}</p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {!breach && (
            <button type="button" className="pixel-button" onClick={onRetry}>
              Try again
            </button>
          )}
          <button type="button" className="pixel-button" onClick={onClose}>
            {breach ? "Collect bounty" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
