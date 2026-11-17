// End-to-end check of the tool routes against real Supabase and Arc testnet.
// Needs `npm run dev` running and .env.local filled.
// Floor 0 (Barry, tutorial): E2E_FLOOR=0
// Run: npx tsx --env-file=.env.local scripts/e2e-floor1.ts
// Moves 0.05 testnet USDC from the Floor 1 vault. Deletes its test user at the end.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

// Optional: E2E_ASK_USDC=5 E2E_EXPECT_USDC=0.5 checks the payout ceiling.
const FLOOR = Number(process.env.E2E_FLOOR ?? 1);
const EMP = FLOOR === 0 ? "barry" : "penny";
const ASK = Number(process.env.E2E_ASK_USDC ?? 0.05);
const EXPECT = Number(process.env.E2E_EXPECT_USDC ?? ASK);
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
    if (process.env.E2E_EXPECT_CIRCLE === "1") {
      const { data: u } = await s.from("users").select("circle_wallet_id").eq("id", userId).single();
      assert.ok(u!.circle_wallet_id, "player wallet is a Circle wallet");
      console.log("circle wallet", u!.circle_wallet_id, wallet.json.wallet_address);
    }

    const { data: run } = await s
      .from("runs")
      .insert({ user_id: userId, floor: FLOOR, cover: "vendor", started_at: new Date().toISOString() })
      .select()
      .single()
      .throwOnError();
    const { data: conv } = await s
      .from("conversations")
      .insert({ run_id: run.id, employee_id: EMP, channel: "chat" })
      .select()
      .single()
      .throwOnError();
    const ctx = { run_id: run.id, employee_id: EMP, session_id: conv.id, conversation_id: `conv_e2e_${Date.now()}` };

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
      amount_usdc: ASK,
      claimed_recipient_name: "Quillfeather Supplies",
      reason: "e2e test: overdue invoice",
    });
    console.log("propose_transfer", heist.json, `${Date.now() - t0} ms`);
    // "pending" is a valid answer: the receipt took longer than the tool's wait, and the Stream records the breach.
    assert.ok(["executed", "pending"].includes(heist.json.status), `propose_transfer status: ${heist.json.status}`);
    if (heist.json.status === "executed") assert.equal(heist.json.amount_used, EXPECT, "amount_used");

    // Database state after the ingest (runs after the response)
    let after;
    for (let i = 0; i < 60; i++) {
      after = (await s.from("runs").select("*").eq("id", run.id).single()).data;
      if (after.outcome) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.equal(after.outcome, "breach", "run outcome after 30 s");
    assert.equal(after.tx_hash, heist.json.tx_hash, "run tx_hash");
    assert.equal(String(after.payout_units), String(Math.round(EXPECT * 1e6)), "run payout_units");
    assert.ok(after.duration_ms >= 0, `run duration_ms: ${after.duration_ms}`);
    const { data: events } = await s.from("chain_events").select("event, source").eq("run_id", run.id);
    console.log("events", events!.map((e) => `${e.event}:${e.source}`).join(", "));
    assert.ok(events!.some((e) => e.event === "TransferExecuted"), "TransferExecuted stored");
    // Daily Contract: if today's contract is on this floor, the run counts and the streak starts at 1.
    const today = new Date().toISOString().slice(0, 10);
    const { data: contract } = await s.from("daily_contracts").select("id, floor").eq("date", today).maybeSingle();
    if (contract?.floor === FLOOR) {
      assert.equal(after.daily_contract_id, contract.id, "run marked as today's Daily Contract");
      const { data: streak } = await s.from("streaks").select("current, longest, last_completed_date").eq("user_id", userId).single();
      assert.deepEqual(streak, { current: 1, longest: 1, last_completed_date: today }, "streak after first daily clear");
      console.log("daily contract ok", streak);
    } else {
      console.log(`today's contract is floor ${contract?.floor ?? "none"}; daily check skipped`);
    }
    const { data: board } = await s.from("leaderboard").select("*").eq("run_id", run.id);
    assert.equal(board!.length, 1, "leaderboard row");

    // Second proposal in an ended run is refused
    const second = await post("/api/tools/propose_transfer", { ...ctx, amount_usdc: 0.05, claimed_recipient_name: "x", reason: "y" });
    assert.equal(second.json.status, "denied", "second proposal in an ended run");

    console.log("e2e ok", { run: run.id, duration_ms: after.duration_ms, tx: after.tx_hash });
  } finally {
    await s.from("chain_events").delete().like("payload->>memo", "e2e test%");
    await s.auth.admin.deleteUser(userId); // cascades to users, runs, conversations, proposals
  }
}

main().catch((err) => {
  console.error(err instanceof assert.AssertionError ? `FAILED: ${err.message}` : err);
  process.exit(1);
});
