// End-to-end check of the tool routes against real Supabase and Arc testnet.
// Needs `npm run dev` running and .env.local filled.
// Run: npx tsx --env-file=.env.local scripts/e2e-floor1.ts
// Moves 0.05 testnet USDC from the Floor 1 vault. Deletes its test user at the end.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.TOOLS_BASE_URL ?? "http://localhost:3000";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const headers = { "content-type": "application/json", "x-coldcall-tool-secret": process.env.TOOL_SHARED_SECRET! };

async function post(path: string, body: unknown, h: Record<string, string> = headers) {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: h, body: JSON.stringify(body) });
  return { http: res.status, json: await res.json() };
}

async function main() {
  const email = `e2e-${Date.now()}@example.test`;
  const { data: created, error } = await s.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  try {
    await s.from("users").insert({ id: userId, display_name: "e2e" }).throwOnError();

    const wallet = await post("/api/chain/player-wallet", { user_id: userId });
    assert.equal(wallet.http, 200);
    const again = await post("/api/chain/player-wallet", { user_id: userId });
    assert.equal(again.json.wallet_address, wallet.json.wallet_address, "wallet endpoint is idempotent");

    const { data: run } = await s
      .from("runs")
      .insert({ user_id: userId, floor: 1, cover: "vendor", started_at: new Date().toISOString() })
      .select()
      .single()
      .throwOnError();
    const { data: conv } = await s
      .from("conversations")
      .insert({ run_id: run.id, employee_id: "penny", channel: "chat" })
      .select()
      .single()
      .throwOnError();
    const ctx = { run_id: run.id, employee_id: "penny", session_id: conv.id, conversation_id: `conv_e2e_${Date.now()}` };

    // Auth failures
    const noSecret = await post("/api/tools/propose_transfer", ctx, { "content-type": "application/json" });
    assert.equal(noSecret.http, 401);
    const wrongEmployee = await post("/api/tools/propose_transfer", { ...ctx, employee_id: "dee", amount_usdc: 1 });
    assert.equal(wrongEmployee.json.status, "denied");
    const wrongFloor = await post("/api/tools/propose_allowlist_add", { ...ctx, claimed_name: "x", reason: "y" });
    assert.equal(wrongFloor.json.status, "denied");

    // Lookup goes through B's function
    const vendor = await post("/api/tools/check_vendor_list", { ...ctx, vendor_name: "No Such Vendor LLC" });
    assert.equal(vendor.json.match, false);

    // The heist
    const t0 = Date.now();
    const heist = await post("/api/tools/propose_transfer", {
      ...ctx,
      amount_usdc: 0.05,
      claimed_recipient_name: "Quillfeather Supplies",
      reason: "e2e test: overdue invoice",
    });
    console.log("propose_transfer", heist.json, `${Date.now() - t0} ms`);
    assert.equal(heist.json.status, "executed");
    assert.equal(heist.json.amount_used, 0.05);

    // Database state after the ingest (runs after the response)
    let after;
    for (let i = 0; i < 20; i++) {
      after = (await s.from("runs").select("*").eq("id", run.id).single()).data;
      if (after.outcome) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.equal(after.outcome, "breach");
    assert.equal(after.tx_hash, heist.json.tx_hash);
    assert.equal(String(after.payout_units), "50000");
    assert.ok(after.duration_ms >= 0);
    const { data: events } = await s.from("chain_events").select("event, source").eq("run_id", run.id);
    console.log("events", events!.map((e) => e.event).join(", "));
    assert.ok(events!.some((e) => e.event === "TransferExecuted"));
    const { data: board } = await s.from("leaderboard").select("*").eq("run_id", run.id);
    assert.equal(board!.length, 1);

    // Second proposal in an ended run is refused
    const second = await post("/api/tools/propose_transfer", { ...ctx, amount_usdc: 0.05, claimed_recipient_name: "x", reason: "y" });
    assert.equal(second.json.status, "denied");

    console.log("e2e ok", { run: run.id, duration_ms: after.duration_ms, tx: after.tx_hash });
  } finally {
    await s.from("chain_events").delete().like("payload->>memo", "e2e test%");
    await s.auth.admin.deleteUser(userId); // cascades to users, runs, conversations, proposals
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
