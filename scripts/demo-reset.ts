// Resets a player to a clean state before a demo: closes open runs (outcome "quit", then the chain
// cleanup, which takes the player off the Floor 3 allowlist) and clears employee memory of them.
// Breached runs stay, so the leaderboard and its proof links are untouched.
//
//   npx tsx --env-file=.env.local scripts/demo-reset.ts            # the shared demo player
//   npx tsx --env-file=.env.local scripts/demo-reset.ts <user-id>  # one player
import type { Hex } from "viem";
import { deployment } from "../server/chain/config";
import { db } from "../server/chain/db";
import { onRunEnded } from "../server/chain/ingest";
import { isAllowlisted } from "../server/chain/vault";

const DEMO_EMAIL = "demo-hunter@coldcall.test"; // same as agents/reset-memory.ts

async function main() {
  const s = db();
  let userId = process.argv[2];
  if (!userId) {
    const { data, error } = await s.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    const demo = data.users.find((u) => u.email === DEMO_EMAIL);
    if (!demo) return console.log("no demo player yet; nothing to reset");
    userId = demo.id;
  }

  const { data: open } = await s.from("runs").select("id, floor").eq("user_id", userId).is("outcome", null).throwOnError();
  for (const run of open ?? []) {
    await s
      .from("runs")
      .update({ outcome: "quit", ended_at: new Date().toISOString() })
      .eq("id", run.id)
      .is("outcome", null)
      .throwOnError();
    await onRunEnded(run.id);
    console.log(`closed run ${run.id} (floor ${run.floor})`);
  }

  const { count } = await s.from("player_memory").delete({ count: "exact" }).eq("user_id", userId).throwOnError();
  console.log(`cleared ${count ?? 0} memory line(s)`);

  const { data: user } = await s.from("users").select("wallet_address").eq("id", userId).single().throwOnError();
  if (user?.wallet_address && deployment.floor3) {
    const listed = await isAllowlisted(deployment.floor3 as Hex, user.wallet_address as Hex);
    console.log(`floor 3 allowlist: ${listed ? "STILL LISTED (check the house wallet's gas)" : "not listed"}`);
  }
  console.log(`reset done for ${userId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
