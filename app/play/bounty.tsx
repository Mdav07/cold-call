// The most each level pays, and how hard it is: shown on the briefing, the lobby signs, the HUD and the
// breach card so the climb is obvious. Caps mirror server/chain/tools.ts FLOOR_CAP_UNITS (the vaults'
// per-transfer limits); keep the two in step. Amounts in 6-decimal USDC units.

/** A level: a floor number (0-3, 4 = the Daily Case) or "seasonal" (the holiday case). */
export type Level = number | "seasonal";

export const MAX_BOUNTY_UNITS: Record<Level, number> = {
  0: 1_000_000, // Tutorial
  1: 5_000_000,
  2: 10_000_000,
  3: 25_000_000,
  4: 100_000, // the Daily Case: 10 cents
  seasonal: 500_000, // the holiday case: 50 cents (shared/seasonalCase.ts SEASONAL_CAP_UNITS)
};

/** 1 to 4: how many locks the vault has. */
export const DIFFICULTY: Record<Level, number> = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 1, seasonal: 2 };

/** What stands between you and the money on each level, in a few words. */
export const VAULT_RULE: Record<Level, string> = {
  0: "one signature",
  1: "one signature, capped",
  2: "two signatures, and the second sees the real recipient",
  3: "two executives, and you must be on the allowlist first",
  4: "one signature, a new mark every day",
  seasonal: "one signature, from a warier mark who checks the details",
};

/** "$5" or "10¢". */
export function maxBountyLabel(floor: Level): string {
  const units = MAX_BOUNTY_UNITS[floor] ?? 0;
  return units < 1_000_000 ? `${Math.round(units / 10_000)}¢` : `$${units / 1_000_000}`;
}

/** Four pips, filled up to the level's difficulty. */
export function DifficultyPips({ floor, className = "" }: { floor: Level; className?: string }) {
  const d = DIFFICULTY[floor] ?? 1;
  return (
    <span className={`inline-flex gap-0.5 ${className}`} role="img" aria-label={`Difficulty ${d} of 4`}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={`inline-block h-2 w-2 border border-current ${i <= d ? "bg-current" : ""}`} />
      ))}
    </span>
  );
}
