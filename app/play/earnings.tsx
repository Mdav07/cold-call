"use client";

// What the player has earned so far: everyone starts at $0, and each breach adds its bounty. Signed in,
// the total comes from the account (/api/session/earnings, the same sum as Top earners). Guests keep a
// tally in this browser, shown as "not kept" because guest winnings don't stay with them.

import { useEffect, useState, useSyncExternalStore } from "react";

const GUEST_KEY = "cc-earned-units";
const SEEN_KEY = "cc-earned-runs"; // breaches already added (by tx hash), so a reload doesn't count one twice
const EVENT = "coldcall-earned";

const usd = (units: number) => `$${(units / 1_000_000).toFixed(2)}`;
export const formatUsd = usd;

function readGuest(): number {
  try {
    return Number(localStorage.getItem(GUEST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/** Add a guest's breach to this browser's tally, once per run. Signed-in totals come from the server. */
export function recordGuestEarning(breachKey: string, units: number): void {
  try {
    const seen: string[] = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    if (seen.includes(breachKey)) return;
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen.slice(-200), breachKey]));
    localStorage.setItem(GUEST_KEY, String(readGuest() + units));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/** Ask every earnings display to refresh (after a breach lands). */
export function refreshEarnings(): void {
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** { units, guest } or null while loading. */
export function useEarnings(): { units: number; guest: boolean } | null {
  const guestUnits = useSyncExternalStore(subscribe, readGuest, () => 0);
  const [server, setServer] = useState<{ guest: boolean; units?: number } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    let live = true;
    fetch("/api/session/earnings")
      .then((r) => (r.ok ? r.json() : { guest: true }))
      .then((d) => live && setServer(d))
      .catch(() => live && setServer({ guest: true }));
    return () => {
      live = false;
    };
  }, [tick]);
  if (!server) return null;
  return server.guest ? { units: guestUnits, guest: true } : { units: server.units ?? 0, guest: false };
}

/** The running total as a small chip: "YOU $0.00" on floors, "EARNED $0.00" in the lobby. */
export function EarnedChip({ label = "YOU", className = "" }: { label?: string; className?: string }) {
  const e = useEarnings();
  const title = e?.guest
    ? "What you've talked staff into so far, starting from $0. Playing as a guest, so it isn't kept: sign in to keep it."
    : "What you've talked staff into so far. Everyone starts at $0; each breach adds its bounty.";
  return (
    <span title={title} className={`inline-flex items-center gap-x-1.5 whitespace-nowrap ${className}`}>
      <span className="text-[var(--cc-muted)]">{label}</span>
      {/* Green = your money (vault balances use red in HudVault). Guests stay muted: not kept. */}
      <span className={e?.guest ? "text-[var(--cc-muted)]" : "text-[var(--cc-ok)]"}>{e ? usd(e.units) : "$0.00"}</span>
    </span>
  );
}
