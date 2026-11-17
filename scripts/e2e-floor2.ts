// End-to-end check of Floor 2 (two signers) through the tool routes.
// Run: TOOLS_BASE_URL=https://coldcall-olive.vercel.app npx tsx --env-file=.env.local scripts/e2e-floor2.ts
// Moves 0.05 testnet USDC from the Floor 2 vault. Deletes its test user at the end.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.TOOLS_BASE_URL ?? "http://localhost:3000";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const headers = { "content-type": "application/json", "x-coldcall-tool-secret": process.env.TOOL_SHARED_SECRET! };

async function tool(name: string, body: unknown) {
  const res = await fetch(`${BASE}/api/tools/${name}`, { method: "POST", headers, body: JSON.stringify(body) });
  const json = await res.json();
  console.log(name, json.status, json.tx_hash ?? "");
  return json;
}

async function main() {
  const { data: created, error } = await s.auth.admin.createUser({ email: `e2e2-${Date.now()}@example.test`, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  try {
    await s.from("users").insert({ id: userId, display_name: "e2e2" }).throwOnError();
    const w = await fetch(`${BASE}/api/chain/player-wallet`, { method: "POST", headers, body: JSON.stringify({ user_id: userId }) });
    const player = (await w.json()).wallet_address as string;

    const { data: run } = await s
      .from("runs")
      .insert({ user_id: userId, floor: 2, cover: "payroll vendor", started_at: new Date().toISOString() })
      .select()
      .single()
      .throwOnError();
    const ctx: Record<string, object> = {};
    for (const e of ["annie", "bill"]) {
      const { data: conv } = await s.from("conversations").insert({ run_id: run.id, employee_id: e, channel: "chat" }).select().single().throwOnError();
      ctx[e] = { run_id: run.id, employee_id: e, session_id: conv.id };
    }

    // Annie proposes; one signature is not enough on Floor 2.
    const proposed = await tool("propose_transfer", { ...ctx.annie, amount_usdc: 0.05, claimed_recipient_name: "Ledgerline Payroll", reason: "e2e2 payroll migration" });
    assert.equal(proposed.status, "proposed", "Annie's proposal waits for a second signer");
    const self = await tool("approve_transfer", { ...ctx.annie, proposal_id: proposed.proposal_id, confirm: true });
    assert.notEqual(self.status, "executed", `Annie cannot approve her own proposal (got ${self.status})`);

    // Bill sees the real recipient first, then signs.
    const view = await tool("approve_transfer", { ...ctx.bill, proposal_id: proposed.proposal_id });
    assert.equal(view.status, "needs_confirm", "Bill gets the on-chain view first");
    assert.equal(view.on_chain_view.real_recipient_address.toLowerCase(), player.toLowerCase(), "view shows the real recipient");
    assert.equal(view.on_chain_view.claimed_name, "Ledgerline Payroll");
    assert.equal(view.on_chain_view.proposed_by, "annie");
    const paid = await tool("approve_transfer", { ...ctx.bill, proposal_id: proposed.proposal_id, confirm: true });
    assert.ok(["executed", "pending"].includes(paid.status), `Bill's approval pays (got ${paid.status})`);

    let after;
    for (let i = 0; i < 60; i++) {
      after = (await s.from("runs").select("*").eq("id", run.id).single()).data;
      if (after.outcome) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.equal(after.outcome, "breach", "run outcome after 30 s");
    const { data: events } = await s.from("chain_events").select("event, source").eq("run_id", run.id);
    console.log("events", events!.map((e) => `${e.event}:${e.source}`).join(", "));
    console.log("e2e floor 2 ok", { run: run.id, duration_ms: after.duration_ms, tx: after.tx_hash });
  } finally {
    await s.auth.admin.deleteUser(userId);
  }
}

main().catch((err) => {
  console.error(err instanceof assert.AssertionError ? `FAILED: ${err.message}` : err);
  process.exit(1);
});
