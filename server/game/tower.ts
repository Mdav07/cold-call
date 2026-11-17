// Data for the tower (hub) screen: each floor's vault balance read live from Arc, who works
// there, whether the player has cleared it, and the fastest clears.

import { createPublicClient, erc20Abi, http, type Hex } from "viem";
import agentIds from "@/agents/elevenlabs-ids.json";
import company from "@/content/plumpurse/company.json";
import directory from "@/content/plumpurse/directory.json";
import { arcTestnet, deployment } from "@/server/chain/config";
import { db } from "@/server/chain/db";
import type { FloorId } from "@/shared/interfaces";

export interface TowerEmployee {
  id: string;
  name: string;
  title: string;
  playable: boolean;
}

export interface TowerFloor {
  floor: FloorId;
  name: string;
  description: string;
  vault: string;
  rule: string | null;
  balanceUsd: number | null;
  employees: TowerEmployee[];
  cleared: boolean;
  unlocked: boolean;
  bestMs: number | null; // the player's fastest clear
  board: { name: string; ms: number; channel: string; tx: string }[];
}

const VAULTS: Record<FloorId, Hex | null> = {
  0: deployment.tutorial,
  1: deployment.floor1,
  2: deployment.floor2,
  3: deployment.floor3,
};

const client = createPublicClient({ chain: arcTestnet, transport: http() });

async function vaultBalance(vault: Hex | null): Promise<number | null> {
  if (!vault) return null;
  try {
    const units = await client.readContract({
      address: deployment.usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [vault],
    });
    return Number(units) / 1_000_000;
  } catch {
    return null; // RPC hiccup: show "?" rather than fail the page
  }
}

export async function getTower(userId: string | null): Promise<TowerFloor[]> {
  const agents = agentIds.agents as Record<string, string | undefined>;
  const hasDb = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  const [balances, mine, board] = await Promise.all([
    Promise.all(company.floors.map((f) => vaultBalance(VAULTS[f.floor as FloorId]))),
    userId && hasDb
      ? db().from("runs").select("floor, duration_ms").eq("user_id", userId).eq("outcome", "breach")
      : Promise.resolve({ data: [] as { floor: number; duration_ms: number | null }[] }),
    hasDb
      ? db().from("leaderboard").select("floor, display_name, duration_ms, channel, tx_hash").order("duration_ms").limit(200)
      : Promise.resolve({ data: [] as { floor: number; display_name: string | null; duration_ms: number; channel: string; tx_hash: string }[] }),
  ]);

  const clears = mine.data ?? [];
  const rows = board.data ?? [];

  const floors: TowerFloor[] = company.floors.map((f, i) => {
    const floor = f.floor as FloorId;
    const myClears = clears.filter((r) => r.floor === floor && r.duration_ms != null);
    return {
      floor,
      name: f.name,
      description: f.description,
      vault: f.vault,
      rule: "vault_rule" in f ? (f.vault_rule as string) : null,
      balanceUsd: balances[i],
      employees: directory.employees
        .filter((e) => e.is_signer && e.floor === floor)
        .map((e) => ({ id: e.id, name: e.name, title: e.title, playable: !!agents[e.id] })),
      cleared: myClears.length > 0,
      unlocked: true, // set below
      bestMs: myClears.length ? Math.min(...myClears.map((r) => r.duration_ms as number)) : null,
      board: rows
        .filter((r) => r.floor === floor)
        .slice(0, 3)
        .map((r) => ({ name: r.display_name ?? "Anonymous hunter", ms: r.duration_ms, channel: r.channel, tx: r.tx_hash })),
    };
  });

  // Floors unlock in order: the tutorial (Floor 0) is always open, each next floor opens once the one
  // below is cleared.
  for (const f of floors) {
    if (f.floor <= 0) continue;
    f.unlocked = floors.some((g) => g.floor === f.floor - 1 && g.cleared);
  }
  return floors;
}
