// Applies the chain-side cleanup for an ended run (Floor 3: removes the player from the allowlist).
// Run: npx tsx --env-file=.env.local scripts/end-run.ts <run_id>
import type { Hex } from "viem";
import { deployment } from "../server/chain/config";
import { db } from "../server/chain/db";
import { onRunEnded } from "../server/chain/ingest";
import { isAllowlisted } from "../server/chain/vault";

async function main() {
  const runId = process.argv[2];
  if (!runId) throw new Error("usage: end-run.ts <run_id>");
  const { data: run } = await db().from("runs").select("floor, user_id, outcome").eq("id", runId).single();
  const { data: user } = await db().from("users").select("wallet_address").eq("id", run!.user_id).single();
  const who = user!.wallet_address as Hex;
  const listed = () => isAllowlisted(deployment.floor3 as Hex, who);
  console.log("run", run, "player", who, "allowlisted before:", await listed());
  await onRunEnded(runId);
  console.log("allowlisted after:", await listed());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
