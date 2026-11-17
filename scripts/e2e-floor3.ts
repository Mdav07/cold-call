// End-to-end check of Floor 3 (allowlist + timelock) through the tool routes.
// Run: TOOLS_BASE_URL=https://coldcall-olive.vercel.app npx tsx --env-file=.env.local scripts/e2e-floor3.ts
// Takes about 75 s (60 s timelock). Moves 0.05 testnet USDC. Deletes its test user at the end.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Hex } from "viem";
import deployments from "../deployments/arc-testnet.json";
import { isAllowlisted } from "../server/chain/vault";

const BASE = process.env.TOOLS_BASE_URL ?? "http://localhost:3000";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const headers = { "content-type": "application/json", "x-coldcall-tool-secret": process.env.TOOL_SHARED_SECRET! };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tool(name: string, body: unknown) {
  const res = await fetch(`${BASE}/api/tools/${name}`, { method: "POST", headers, body: JSON.stringify(body) });
  const json = await res.json();
  console.log(name, json.status, json.unlock_at ?? "", json.tx_hash ?? "");
  return json;
}

async function main() {
  const floor3 = deployments.floor3 as Hex;
  const { data: created, error } = await s.auth.admin.createUser({ email: `e2e3-${Date.now()}@example.test`, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  try {
    await s.from("users").insert({ id: userId, display_name: "e2e3" }).throwOnError();
    const w = await fetch(`${BASE}/api/chain/player-wallet`, { method: "POST", headers, body: JSON.stringify({ user_id: userId }) });
    const player = (await w.json()).wallet_address as Hex;

    const { data: run } = await s
      .from("runs")
      .insert({ user_id: userId, floor: 3, cover: "board advisor", started_at: new Date().toISOString() })
      .select()
      .single()
      .throwOnError();
    const ctx: Record<string, object> = {};
    for (const e of ["cassius", "max"]) {
      const { data: conv } = await s
        .from("conversations")
        .insert({ run_id: run.id, employee_id: e, channel: "chat" })
        .select()
        .single()
        .throwOnError();
      ctx[e] = { run_id: run.id, employee_id: e, session_id: conv.id };
    }

    // 1. The pitch beat: a direct transfer is refused by the contract.
    const direct = await tool("propose_transfer", { ...ctx.cassius, amount_usdc: 0.05, claimed_recipient_name: "Board advisor", reason: "e2e3 direct" });
    assert.equal(direct.status, "not_allowlisted");

    // 2. Allowlist add: propose, then the second approval queues it behind the timelock.
    const add = await tool("propose_allowlist_add", { ...ctx.cassius, claimed_name: "Board advisor", reason: "e2e3 onboarding" });
    assert.equal(add.status, "proposed");
    const dup = await tool("propose_allowlist_add", { ...ctx.max, claimed_name: "Board advisor", reason: "again" });
    assert.equal(dup.status, "proposal_limit");
    const queued = await tool("approve_allowlist_add", { ...ctx.max, allowlist_id: add.allowlist_id });
    assert.equal(queued.status, "queued");
    assert.ok(queued.unlock_at);

    // 3. Too early: still refused.
    await sleep(8000); // let the Stream mark the proposal as queued
    const early = await tool("propose_transfer", { ...ctx.max, amount_usdc: 0.05, claimed_recipient_name: "Board advisor", reason: "e2e3 early" });
    assert.equal(early.status, "not_allowlisted");

    // 4. After the timelock: lazy finalize inside propose_transfer, then the second approval pays.
    const waitMs = Date.parse(queued.unlock_at) - Date.now() + 4000;
    console.log(`waiting ${Math.round(waitMs / 1000)} s for the timelock`);
    await sleep(Math.max(0, waitMs));
    const proposed = await tool("propose_transfer", { ...ctx.max, amount_usdc: 0.05, claimed_recipient_name: "Board advisor", reason: "e2e3 advisory retainer" });
    assert.equal(proposed.status, "proposed");
    const view = await tool("approve_transfer", { ...ctx.cassius, proposal_id: proposed.proposal_id });
    assert.equal(view.status, "needs_confirm");
    assert.equal(view.on_chain_view.real_recipient_address.toLowerCase(), player.toLowerCase());
    assert.equal(view.on_chain_view.memo, "e2e3 advisory retainer");
    assert.match(view.on_chain_view.real_recipient_label, /^On the approved recipient list: Board advisor/);
    assert.equal(view.on_chain_view.proposed_by, "max");
    const paid = await tool("approve_transfer", { ...ctx.cassius, proposal_id: proposed.proposal_id, confirm: true });
    assert.equal(paid.status, "executed");

    // 5. The run is a breach and the player is removed from the allowlist again.
    let after;
    for (let i = 0; i < 60; i++) {
      after = (await s.from("runs").select("*").eq("id", run.id).single()).data;
      if (after.outcome && !(await isAllowlisted(floor3, player))) break;
      await sleep(500);
    }
    assert.equal(after.outcome, "breach");
    assert.equal(await isAllowlisted(floor3, player), false, "player removed from the allowlist after the run");
    const { data: events } = await s.from("chain_events").select("event, source").eq("run_id", run.id);
    console.log("events", events!.map((e) => `${e.event}:${e.source}`).join(", "));
    console.log("e2e floor 3 ok", { run: run.id, duration_ms: after.duration_ms, tx: after.tx_hash });
  } finally {
    await s.auth.admin.deleteUser(userId);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
