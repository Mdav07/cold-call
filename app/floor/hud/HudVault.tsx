// Server part of the HUD: this floor's vault balance (read live from Arc) and today's Daily
// Contract badge. Rendered inside <Suspense>.

import { loadTower } from "./data";

export async function HudVault({ floor }: { floor: number }) {
  const { floors, daily } = await loadTower();
  const f = floors.find((x) => x.floor === floor);
  const balance = f?.balanceUsd ?? null;
  const contract = daily?.contract?.floor === floor ? daily.contract : null;
  return (
    <>
      <span title={`${f?.vault ?? "Floor"} vault balance (USDC on Arc testnet)`}>
        <span className="text-[var(--cc-muted)]">VAULT </span>
        <span className="text-[var(--cc-ok)]">{balance == null ? "?" : `$${balance.toFixed(2)}`}</span>
      </span>
      {contract && (
        <span className="bg-[var(--cc-accent)] px-2 py-0.5 text-[var(--cc-edge)]" title={`Daily Contract: ${contract.modifier}`}>
          {daily?.clearedToday ? "DAILY ✓" : "DAILY"}
        </span>
      )}
    </>
  );
}
