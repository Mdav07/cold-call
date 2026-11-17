// Prints the USDC balance of every vault and wallet, and refills the low ones from the house wallet.
// Run:   npx tsx --env-file=.env.local scripts/topup.ts            (print only)
//        npx tsx --env-file=.env.local scripts/topup.ts --apply    (send the refills)
// Targets (USDC): VAULT_TARGET (default 5), GAS_TARGET for employee wallets (default 0.25).
// A wallet is refilled to its target only when it holds less than half of it.
import { createWalletClient, erc20Abi, formatUnits, http, parseUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, deployment } from "../server/chain/config";
import { addressOf, publicClient, type SignerName } from "../server/chain/vault";

const APPLY = process.argv.includes("--apply");
const VAULT_TARGET = parseUnits(process.env.VAULT_TARGET ?? "5", 6);
const GAS_TARGET = parseUnits(process.env.GAS_TARGET ?? "0.25", 6);
const usdc = deployment.usdc as Hex;
const fmt = (u: bigint) => formatUnits(u, 6);

const balanceOf = (who: Hex) =>
  publicClient.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [who] });

async function main() {
  const house = privateKeyToAccount(process.env.HOUSE_PRIVATE_KEY as Hex);
  const wallet = createWalletClient({ account: house, chain: arcTestnet, transport: http() });

  const targets: { name: string; address: Hex; target: bigint }[] = [];
  for (const v of ["tutorial", "floor1", "floor2", "floor3"] as const) {
    targets.push({ name: `${v} vault`, address: deployment[v] as Hex, target: VAULT_TARGET });
  }
  for (const e of ["barry", "penny", "dee", "annie", "bill", "cassius", "max"] as SignerName[]) {
    targets.push({ name: e, address: addressOf(e), target: GAS_TARGET });
  }

  console.log(`house           ${fmt(await balanceOf(house.address)).padStart(12)}  ${house.address}`);
  let needed = 0n;
  for (const t of targets) {
    const bal = await balanceOf(t.address);
    const refill = bal * 2n < t.target ? t.target - bal : 0n;
    needed += refill;
    console.log(`${t.name.padEnd(15)} ${fmt(bal).padStart(12)}  ${t.address}${refill ? `  -> refill ${fmt(refill)}` : ""}`);
    if (refill && APPLY) {
      const hash = await wallet.writeContract({ address: usdc, abi: erc20Abi, functionName: "transfer", args: [t.address, refill] });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  sent ${fmt(refill)}: ${receipt.status} ${hash}`);
    }
  }
  console.log(needed ? `${APPLY ? "sent" : "would send"} ${fmt(needed)} USDC in total` : "nothing to refill");
  if (needed && !APPLY) console.log("run again with --apply to send");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
