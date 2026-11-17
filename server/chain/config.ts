import { defineChain, pad, type Hex } from "viem";
import deployments from "@/deployments/arc-testnet.json";
import type { Deployments } from "@/shared/interfaces";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  // Native gas is USDC with 18 decimals. Vault amounts use the ERC-20 interface (6 decimals).
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.ARC_TESTNET_RPC_URL ?? "https://rpc.testnet.arc.io"] },
  },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.testnet.arc.io" },
  },
  testnet: true,
});

export const USDC_DECIMALS = 6;

export const deployment = deployments as Deployments;

export const EXPLORER_URL =
  process.env.ARC_EXPLORER_URL ?? arcTestnet.blockExplorers.default.url;

export function explorerTxUrl(txHash: Hex): string {
  return `${EXPLORER_URL}/tx/${txHash}`;
}

/** Run uuid -> bytes32 used on chain (dashes removed, left-padded with zeros). */
export function runIdToBytes32(runId: string): Hex {
  const hex = runId.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error("run id is not a uuid");
  return pad(`0x${hex}`, { size: 32 });
}

/** bytes32 from chain -> run uuid. Returns null if the value is not a padded uuid. */
export function bytes32ToRunId(value: Hex): string | null {
  const hex = value.slice(2).toLowerCase();
  if (hex.length !== 64 || !/^0{32}/.test(hex)) return null;
  const u = hex.slice(32);
  return `${u.slice(0, 8)}-${u.slice(8, 12)}-${u.slice(12, 16)}-${u.slice(16, 20)}-${u.slice(20)}`;
}
