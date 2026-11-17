// Server part of the HUD: this floor's vault balance (read live from Arc) and today's Daily
// Contract badge. Rendered inside <Suspense> because it reads cookies and the chain.

import { connection } from "next/server";
import { signedInUserId } from "@/server/game/auth";
import { getDemoUserId } from "@/server/game/players";
import { getTower } from "@/server/game/tower";
import { getDaily } from "@/server/game/daily";

export async function HudVault({ floor }: { floor: number }) {
  // Request-time only: the Daily Contract reads today's date and the balance is live.
  await connection();
  let balance: number | null = null;
  let vault = "Vault";
  let daily: { modifier: string; cleared: boolean } | null = null;
  try {
    const userId = (await signedInUserId()) ?? (process.env.SUPABASE_SERVICE_ROLE_KEY ? await getDemoUserId() : null);
    const [floors, d] = await Promise.all([getTower(userId), getDaily(userId)]);
    const f = floors.find((x) => x.floor === floor);
    balance = f?.balanceUsd ?? null;
    vault = f?.vault ?? vault;
    if (d.contract?.floor === floor) daily = { modifier: d.contract.modifier, cleared: d.clearedToday };
  } catch {
    // No database or RPC: the HUD shows "?" rather than failing the floor.
  }
  return (
    <>
      <span title={`${vault} vault balance (USDC on Arc testnet)`}>
        <span className="text-[var(--cc-muted)]">VAULT </span>
        <span className="text-[var(--cc-ok)]">{balance == null ? "?" : `$${balance.toFixed(2)}`}</span>
      </span>
      {daily && (
        <span
          className="bg-[var(--cc-accent)] px-2 py-0.5 text-[var(--cc-edge)]"
          title={`Daily Contract: ${daily.modifier}`}
        >
          {daily.cleared ? "DAILY ✓" : "DAILY"}
        </span>
      )}
    </>
  );
}
