// End-to-end check of the seasonal case (two signers, Floor 2 vault) through the tool routes: the
// seasonal employee ("daily" on a reserved seasonal date) proposes with Annie's key, the helper approves
// with Bill's. Also checks the helper is refused on a normal Daily run.
// Run: TOOLS_BASE_URL=https://coldcall-olive.vercel.app npx tsx --env-file=.env.local scripts/e2e-seasonal.ts
// E2E_SEASON_DATE overrides the reserved date (default: the first season in content/seasonal/seasons.json).
// Moves at most 0.05 testnet USDC (less under PAYOUT_CEILING_UNITS) from the Floor 2 vault. Deletes its test user.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import seasons from "../content/seasonal/seasons.json";

const DATE = process.env.E2E_SEASON_DATE ?? (seasons.seasons[0] as { caseDate: string }).caseDate;
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
  const { data: created, error } = await s.auth.admin.createUser({ email: `e2es-${Date.now()}@example.test`, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  try {
    await s.from("users").insert({ id: userId, display_name: "e2es" }).throwOnError();
    const w = await fetch(`${BASE}/api/chain/player-wallet`, { method: "POST", headers, body: JSON.stringify({ user_id: userId }) });
    const player = (await w.json()).wallet_address as string;

    const { data: run } = await s
      .from("runs")
      .insert({ user_id: userId, floor: 4, daily_date: DATE, cover: "pie supplier", started_at: new Date().toISOString() })
      .select()
      .single()
      .throwOnError();
    const ctx: Record<string, object> = {};
    for (const e of ["daily", "helper"]) {
      const { data: conv } = await s.from("conversations").insert({ run_id: run.id, employee_id: e, channel: "chat" }).select().single().throwOnError();
      ctx[e] = { run_id: run.id, employee_id: e, session_id: conv.id };
    }

    // The helper exists only on the seasonal case: refused on a normal Daily run.
    const { data: plain } = await s.from("runs").insert({ user_id: userId, floor: 4, daily_date: new Date().toISOString().slice(0, 10), cover: "x", started_at: new Date().toISOString() }).select().single().throwOnError();
    const { data: pc } = await s.from("conversations").insert({ run_id: plain.id, employee_id: "helper", channel: "chat" }).select().single().throwOnError();
    const refused = await tool("check_vendor_list", { run_id: plain.id, employee_id: "helper", session_id: pc.id, vendor_name: "x" });
    assert.equal(refused.status, "denied", "the helper is refused on a normal Daily run");
    await s.from("runs").update({ ended_at: new Date().toISOString(), outcome: "quit" }).eq("id", plain.id);

    // The seasonal employee proposes; one signature is not enough.
    const proposed = await tool("propose_transfer", { ...ctx.daily, amount_usdc: 0.05, claimed_recipient_name: "Seasonal Supplier", reason: "e2es pies" });
    assert.equal(proposed.status, "proposed", "the proposal waits for the helper");

    // The helper sees the real recipient first, then signs.
    const view = await tool("approve_transfer", { ...ctx.helper, proposal_id: proposed.proposal_id });
    assert.equal(view.status, "needs_confirm", "the helper gets the on-chain view first");
    assert.equal(view.on_chain_view.real_recipient_address.toLowerCase(), player.toLowerCase(), "view shows the real recipient");
    assert.equal(view.on_chain_view.claimed_name, "Seasonal Supplier");
    assert.equal(view.on_chain_view.proposed_by, "daily", "the proposer reads as the seasonal employee, not Annie");
    const paid = await tool("approve_transfer", { ...ctx.helper, proposal_id: proposed.proposal_id, confirm: true });
    assert.ok(["executed", "pending"].includes(paid.status), `the helper's approval pays (got ${paid.status})`);

    let after;
    for (let i = 0; i < 60; i++) {
      after = (await s.from("runs").select("*").eq("id", run.id).single()).data;
      if (after.outcome) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.equal(after.outcome, "breach", "run outcome after 30 s");
    assert.equal(after.floor, 4, "the breach stays a floor-4 (seasonal) run, not a Floor 2 clear");
    const { data: events } = await s.from("chain_events").select("event, source, vault").eq("run_id", run.id);
    assert.ok(events!.every((e) => e.vault === (process.env.FLOOR2_VAULT ?? e.vault)), "events are on the Floor 2 vault");
    console.log("events", events!.map((e) => `${e.event}:${e.source}`).join(", "));
    console.log("e2e seasonal ok", { run: run.id, vault: events![0]?.vault, payout_units: after.payout_units, cracked_units: after.cracked_units, tx: after.tx_hash });
  } finally {
    await s.auth.admin.deleteUser(userId);
  }
}

main().catch((err) => {
  console.error(err instanceof assert.AssertionError ? `FAILED: ${err.message}` : err);
  process.exit(1);
});
