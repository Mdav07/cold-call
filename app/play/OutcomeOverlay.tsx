"use client";

// Full-screen result after a run ends, in the look of Krystal's briefing: the breach (alarm, PA
// announcer, bounty, time, streak on the Daily) or the lockout, one line from Krystal, details behind More. Audio is pre-generated with ElevenLabs into
// public/audio by agents/generate-audio.ts.

import { useEffect, useRef, useState } from "react";
import { REDUCED_MOTION, useMediaQuery } from "./clientHooks";
import debriefs from "@/content/plumpurse/debriefs.json";
import krystal from "@/content/plumpurse/krystal.json";
import type { RunState } from "./useRunState";
import { PORTRAITS } from "./portraits";
import { StreakBadge } from "./StreakBadge";
import { useStreak } from "./streak";
import { DAILY_FLOOR, dailyCase } from "@/shared/dailyCase";
import { CoinLogo } from "@/app/play/CoinLogo";
import { formatUsd, recordGuestEarning, refreshEarnings, useEarnings } from "./earnings";
import { maxBountyLabel } from "./bounty";

type Debrief = {
  title: string;
  real_world: string;
  patch: string;
  lesson: string;
  source?: { label: string; url: string };
};

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

/** Counts from 0 up to `to` dollars over about a second (shown at once with reduced motion). */
function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(0);
  const reduced = useMediaQuery(REDUCED_MOTION);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 1000);
      setV(to * (1 - (1 - k) ** 3)); // ease-out
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, reduced]);
  return <>{"$" + (reduced ? to : v).toFixed(2)}</>;
}

/** Krystal's one line on the result: short, in her voice. The longer debrief is behind "More". */
function krystalLine(state: RunState, employeeName: string, debrief: Debrief | undefined): string {
  const run = state.run!;
  const breach = run.outcome === "breach";
  if (run.floor === DAILY_FLOOR) {
    if (!breach) return `${employeeName} hung up on you. Read the notes again: one of them is the line you can't cross.`;
    if (run.practice) return "Good practice. Today's case is the one that counts.";
    return "Clean work. A new case opens at midnight UTC. Don't break the streak.";
  }
  if (breach) return debrief?.real_world ?? `${employeeName} paid. Nicely done.`;
  return debrief?.lesson ?? `${employeeName} saw through you. Come back with a different story.`;
}

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
  // Guests can play everything, but only signed-in hunters keep winnings (/api/session/streak says which).
  const guest = useStreak()?.guest === true;
  const earned = useEarnings();
  const [more, setMore] = useState(false);
  const primary = useRef<HTMLButtonElement>(null);

  // The alarm (and the PA announcer, and the flashing red border) is for the tower's real floors, 1–3.
  // The tutorial and the Daily Case win quietly.
  const quietWin = run?.floor === 0 || run?.floor === DAILY_FLOOR;
  useEffect(() => {
    if (played.current || !outcome) return;
    played.current = true;
    if (outcome === "breach") return quietWin ? undefined : playSequence(["breach-alarm.mp3", "breach-announcer.mp3"]);
    if (outcome === "lockout") return playSequence(["lockout-null.mp3"]);
  }, [outcome, quietWin]);
  useEffect(() => primary.current?.focus(), [outcome]);
  // A breach adds its bounty to the running total: guests' tally in this browser (once per run),
  // signed-in players' from the server (the breach is already recorded when this shows).
  const bountyUnits = run?.cracked_units ?? run?.payout_units ?? null;
  useEffect(() => {
    if (outcome !== "breach" || !run || bountyUnits == null) return;
    if (guest) {
      // The breach's transaction is unique to it, so it keys the once-only add.
      const key = run.tx_hash ?? run.ended_at;
      if (!run.practice && key) recordGuestEarning(key, Number(bountyUnits));
    } else refreshEarnings();
  }, [outcome, run, bountyUnits, guest]);

  if (!run || (outcome !== "breach" && outcome !== "lockout")) return null;
  const debrief = (debriefs.floors as Record<string, Debrief>)[String(run.floor)];
  const clue = (krystal.clues as Record<string, { title: string; text: string }>)[String(run.floor)];
  const breach = outcome === "breach";
  const daily = run.floor === DAILY_FLOOR;
  // The bounty is what the employee agreed to ("cracked"), falling back to what the chain paid.
  const bounty = run.cracked_units ?? run.payout_units;
  const paid = bounty != null ? Number(bounty) / 1_000_000 : null;
  const Face = PORTRAITS.krystal;
  // The Daily's debrief is the case itself: who it was, what got through to them, what they won't do.
  // Not after a lockout on today's case: it would hand over the answers to a case you can still retry.
  const caseNotes = daily && run.daily_date && (breach || run.practice) ? dailyCase(run.daily_date) : null;
  // Today's case pays its full bounty once per account; a second clear (or a guest on the shared demo
  // account after someone else) gets the token. Say so, or $0.01 reads like a bug.
  // A 1¢ token instead of the full bounty: a repeat clear (or, for the Daily Case, today's bounty already taken).
  const tokenOnly = breach && !run.practice && paid != null && paid > 0 && paid <= 0.01;
  const hasMore = !!caseNotes || !!debrief || (breach && !!clue) || (!breach && !!state.reason);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-3 sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="outcome-title"
        className={`pixel-frame flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col gap-5 overflow-y-auto bg-[var(--cc-panel)] p-4 sm:p-6 ${breach && !quietWin ? "cc-alarm" : ""}`}
      >
        {/* The same chapter band as Krystal's briefing: gold for a breach, red for a lockout. */}
        <header
          className="-mx-4 -mt-4 border-b-4 border-[var(--cc-edge)] px-4 pb-3 pt-4 text-[var(--cc-edge)] sm:-mx-6 sm:-mt-6 sm:px-6"
          style={{ background: breach ? "var(--cc-accent)" : "var(--cc-danger)" }}
        >
          <p className="flex items-center gap-2 font-pixel text-[9px] tracking-widest">
            <CoinLogo size={16} />
            <span className="max-sm:hidden">COLD CALL · </span>
            {daily ? `DAILY CASE${run.daily_date ? ` · ${run.daily_date}` : ""}` : run.floor === 0 ? "TUTORIAL" : `FLOOR ${run.floor}`}
          </p>
          <h2 id="outcome-title" className="mt-2 font-pixel text-base leading-snug sm:text-xl">
            <span className="cc-stamp">{breach ? "Vault breached" : "Locked out"}</span>
          </h2>
        </header>

        {(breach || (daily && run.practice)) && (
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            {breach && (
              <div>
                <p className="font-pixel text-[9px] text-[var(--cc-muted)]">{guest ? "BOUNTY · NOT KEPT" : "BOUNTY"}</p>
                <p className={`mt-1 font-pixel text-lg ${guest ? "text-[var(--cc-muted)] line-through" : "text-[var(--cc-ok)]"}`}>
                  {paid != null ? <CountUp to={paid} /> : "…"}
                </p>
                <p className="mt-1 text-xs text-[var(--cc-muted)]">of {maxBountyLabel(run.floor)} max</p>
              </div>
            )}
            {breach && earned && paid != null && (
              <div title="Everyone starts at $0; each breach adds its bounty.">
                <p className="font-pixel text-[9px] text-[var(--cc-muted)]">{guest ? "TOTAL · NOT KEPT" : "TOTAL EARNED"}</p>
                <p className={`mt-1 font-pixel text-lg ${guest ? "text-[var(--cc-muted)]" : "text-[var(--cc-accent)]"}`}>
                  {formatUsd(earned.units)} <span className="text-[10px] text-[var(--cc-ok)]">+{formatUsd(paid * 1_000_000)}</span>
                </p>
              </div>
            )}
            {breach && (
              <div>
                <p className="font-pixel text-[9px] text-[var(--cc-muted)]">TIME</p>
                <p className="mt-1 font-pixel text-lg text-[var(--cc-ink)]">{run.duration_ms != null ? clock(run.duration_ms) : "…"}</p>
              </div>
            )}
            {daily && run.practice && (
              <p className="pixel-frame bg-[var(--cc-panel-2)] px-2 py-1 font-pixel text-[9px] text-[var(--cc-muted)]">
                PRACTICE · doesn&apos;t count
              </p>
            )}
          </div>
        )}

        {/* The streak badge knows guests (this browser) from signed-in players (their account). */}
        {daily && !run.practice && <StreakBadge variant="full" />}

        <div className="flex items-start gap-3">
          {Face && (
            <div className="pixel-frame grid h-14 w-14 shrink-0 place-items-center overflow-hidden bg-[var(--cc-portrait)] [&>svg]:h-full [&>svg]:w-full">
              <Face mood={breach ? "convinced" : "neutral"} />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="font-pixel text-[10px] text-[var(--cc-muted)]">
              Krystal says
            </p>
            <p className="font-pixel text-[12px] leading-[1.9] text-[var(--cc-ink)] sm:text-[13px]">
              {krystalLine(state, employeeName, debrief)}
            </p>
          </div>
        </div>

        {more && (
          <div className="flex flex-col gap-3 border-t-2 border-[var(--cc-edge)] pt-4 text-sm leading-relaxed">
            {caseNotes && (
              <div className="flex flex-col gap-2">
                <p className="font-pixel text-[10px] text-[var(--cc-accent)]">
                  The case · {caseNotes.title} · {caseNotes.employee.name}, {caseNotes.employee.title.toLowerCase()}
                </p>
                <p>
                  <span className="text-[var(--cc-ok)]">Way in:</span> {caseNotes.employee.softSpot}
                </p>
                <p>
                  <span className="text-[var(--cc-danger)]">Red line:</span> {caseNotes.employee.redLine}
                </p>
                <p className="text-[var(--cc-muted)]">
                  Booked today: {caseNotes.allowedVendor}, invoice {caseNotes.allowedInvoice}.
                </p>
              </div>
            )}
            {!breach && state.reason && (
              <p>
                <span className="font-pixel text-[10px] text-[var(--cc-accent)]">What gave you away · </span>
                {state.reason.text}
              </p>
            )}
            {run.floor > 0 && !daily && (
              <p>
                <span className="font-pixel text-[10px] text-[var(--cc-accent)]">They learn · </span>
                {employeeName} will remember this. {breach ? "The same trick won't work twice." : "Come back with a different story."}
              </p>
            )}
            {breach && clue && (
              <div>
                <p className="font-pixel text-[10px] text-[var(--cc-accent)]">Krystal&apos;s trail · {clue.title}</p>
                <p className="mt-1 font-pixel text-[11px] leading-loose">{clue.text}</p>
              </div>
            )}
            {debrief && breach && (
              <div>
                <p className="font-pixel text-[10px] text-[var(--cc-accent)]">Debrief · {debrief.title}</p>
                <p className="mt-1 text-[var(--cc-muted)]">Patch notes: {debrief.patch}</p>
                {debrief.source && (
                  <a className="mt-1 block text-xs text-[var(--cc-muted)] underline" href={debrief.source.url} target="_blank" rel="noreferrer">
                    Source: {debrief.source.label}
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {breach && guest && (
          <p className="-mt-2 text-xs text-[var(--cc-ink)]">
            Played as a guest: winnings aren&apos;t kept.{" "}
            <a href="/signin" className="underline text-[var(--cc-accent)]">
              Sign in
            </a>{" "}
            to bank your bounties and get on the Top earners board.
          </p>
        )}
        {tokenOnly && !guest && (
          <p className="-mt-2 text-xs text-[var(--cc-muted)]">
            {daily
              ? "Token pay: today's full bounty was already collected."
              : "Token pay: you've cleared this floor before. The full bounty is for the first clear."}
          </p>
        )}

        {/* Stays in view when a short (sideways phone) screen makes the panel scroll. */}
        <div className="sticky -bottom-4 -mx-4 -mb-4 sm:-bottom-6 flex flex-wrap items-center gap-2 border-t-2 border-[var(--cc-edge)] bg-[var(--cc-panel)] px-4 py-3 sm:-mx-6 sm:-mb-6 sm:px-6 [@media(min-height:700px)]:static [@media(min-height:700px)]:m-0 [@media(min-height:700px)]:border-0 [@media(min-height:700px)]:p-0">
          {breach ? (
            <button ref={primary} type="button" className="pixel-button" onClick={onClose}>
              {guest ? "Continue ▶" : "Collect bounty ▶"}
            </button>
          ) : (
            <>
              <button ref={primary} type="button" className="pixel-button" onClick={onRetry}>
                Try again
              </button>
              <button type="button" className="pixel-button" onClick={onClose}>
                Close
              </button>
            </>
          )}
          {hasMore && (
            <button type="button" className="pixel-button !bg-[var(--cc-panel-2)] !text-[var(--cc-ink)]" aria-expanded={more} onClick={() => setMore((m) => !m)}>
              {more ? "Less" : "More"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
