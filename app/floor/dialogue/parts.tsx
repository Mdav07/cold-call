"use client";

// Small pieces of the chat room, sized for the dialogue box. Local copies until B exports
// SuspicionMeter and ProposalPanel from app/play/ChatRoom.tsx; then these become re-exports.

import type { RunState } from "@/app/play/useRunState";

export type Mood = "neutral" | "suspicious" | "convinced";

/** Same rule as the chat room portrait. */
export const moodFor = (suspicion: number): Mood =>
  suspicion >= 60 ? "suspicious" : suspicion <= 5 ? "convinced" : "neutral";

export function SuspicionMeter({ value }: { value: number }) {
  const tone = value >= 70 ? "bg-[var(--cc-danger)]" : value >= 40 ? "bg-[var(--cc-warn)]" : "bg-[var(--cc-ok)]";
  return (
    <div className="w-full" role="meter" aria-label="Suspicion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <div className="mb-1 flex justify-between text-[10px] text-[var(--cc-muted)]">
        <span className="font-pixel">Suspicion</span>
        <span>{value}</span>
      </div>
      <div className="pixel-frame h-3 w-full bg-[var(--cc-panel-2)]">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

const usd = (u: string | null) => (u == null ? null : Number(u) / 1_000_000);

export function ProposalLine({ state }: { state: RunState | null }) {
  const p = state?.proposal;
  if (!p) return <span>No request yet.</span>;
  const amount = usd(p.amount_units);
  return (
    <span>
      {p.kind === "allowlist" ? "Allowlist add" : `$${amount ?? "?"}`}
      {p.claimed_name ? ` to ${p.claimed_name}` : ""}: <span className="text-[var(--cc-accent)]">{p.status}</span>
      {p.unlock_at && p.status === "queued" ? ` (unlocks ${new Date(p.unlock_at).toLocaleTimeString()})` : ""}
    </span>
  );
}

export const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
