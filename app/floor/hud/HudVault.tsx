// Server part of the HUD: this floor's vault balance (read live from Arc) and today's Daily
// Contract badge. Rendered inside <Suspense>.

import { loadTower } from "./data";
import { VAULT_RULE, maxBountyLabel, type Level } from "@/app/play/bounty";
import { currentSeason } from "@/shared/seasonalCase";

/** Short HUD tag for whose money this is (red amount). */
function vaultTag(level: Level, floorVault: string | undefined): string {
  if (level === "seasonal") return (currentSeason()?.name ?? "Seasonal").toUpperCase();
  if (level === 4) return "DAILY";
  if (level === 0) return "TUTORIAL";
  // Floors 1–3: Plumpurse vaults (Petty Cash / Operations / Treasury).
  return (floorVault ?? "Plumpurse").toUpperCase();
}

/** `level`: whose max bounty to show when the vault is shared (the Daily and seasonal cases pay from the
 *  Tutorial's vault). */
export async function HudVault({ floor, level }: { floor: number; level?: Level }) {
  const lv = level ?? floor;
  const { floors, daily } = await loadTower();
  const f = floors.find((x) => x.floor === floor);
  const balance = f?.balanceUsd ?? null;
  const contract = daily?.contract?.floor === floor ? daily.contract : null;
  const tag = vaultTag(lv, f?.vault);
  return (
    <>
      <span title={`${f?.vault ?? "Floor"} vault balance`}>
        <span className="cc-vault-label text-[var(--cc-muted)]">{tag} </span>
        {/* Red = vault money (your earnings use green in EarnedChip). */}
        <span className="text-[var(--cc-danger)]">{balance == null ? "?" : `$${balance.toFixed(2)}`}</span>
      </span>
      <span className="cc-vault-label" title={`The most this level pays: ${maxBountyLabel(lv)}. Vault: ${VAULT_RULE[lv]}.`}>
        <span className="text-[var(--cc-muted)]">MAX </span>
        <span className="text-[var(--cc-accent)]">{maxBountyLabel(lv)}</span>
      </span>
      {contract && (
        <span className="bg-[var(--cc-accent)] px-2 py-0.5 text-[var(--cc-edge)]" title={`Daily Contract: ${contract.modifier}`}>
          {daily?.clearedToday ? "DAILY ✓" : "DAILY"}
        </span>
      )}
    </>
  );
}
