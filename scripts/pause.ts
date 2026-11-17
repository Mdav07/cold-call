// Kill switch: pauses or resumes all four vaults (admin = house wallet). A paused vault refuses every proposal.
// Run:   npx tsx --env-file=.env.local scripts/pause.ts status
//        npx tsx --env-file=.env.local scripts/pause.ts on
//        npx tsx --env-file=.env.local scripts/pause.ts off
import type { Hex } from "viem";
import { deployment } from "../server/chain/config";
import { publicClient, sendVaultTx, vaultAbi } from "../server/chain/vault";

const mode = process.argv[2];
if (!["status", "on", "off"].includes(mode)) {
  console.error("usage: pause.ts status|on|off");
  process.exit(1);
}

async function main() {
  for (const v of ["tutorial", "floor1", "floor2", "floor3"] as const) {
    const vault = deployment[v] as Hex;
    const paused = (await publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "paused" })) as boolean;
    const want = mode === "on";
    if (mode === "status" || paused === want) {
      console.log(`${v.padEnd(9)} ${paused ? "PAUSED" : "running"}`);
      continue;
    }
    const res = await sendVaultTx("house", vault, { functionName: "setPaused", args: [want] }, 20_000);
    console.log(`${v.padEnd(9)} ${want ? "PAUSED" : "running"}  ${res.receipt ? res.receipt.status : "no receipt yet"} ${res.txHash}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
