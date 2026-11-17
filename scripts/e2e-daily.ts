// End-to-end check of the Daily Case tools against real Supabase and Arc testnet.
// Needs a server running (TOOLS_BASE_URL, default http://localhost:3000) and .env.local filled.
// Run: npx tsx --env-file=.env.local scripts/e2e-daily.ts
// Moves 0.10 testnet USDC from the Pocket Branch vault. Deletes its test user at the end.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { dailyCase, recentDailyDates, todayUtc } from "@/shared/dailyCase";

const BASE = process.env.TOOLS_BASE_URL ?? "http://localhost:3000";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const headers = { "content-type": "application/json", "x-coldcall-tool-secret": process.env.TOOL_SHARED_SECRET! };

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  return { http: res.status, json: await res.json() };
}

async function main() {
  const c = dailyCase();
  const other = c.vendors.find((v) => v.name !== c.allowedVendor)!;
  console.log("today", c.date, c.title, c.employee.name, "pays", c.allowedVendor, c.allowedInvoice);

  const email = `e2e-daily-${Date.now()}@example.test`;
  const { data: created, error } = await s.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  const userId = created.user.id;
  try {
    await s.from("users").insert({ id: userId, display_name: "e2e daily" }).throwOnError();
    const wallet = await post("/api/chain/player-wallet", { user_id: userId });
    assert.equal(wallet.http, 200);

    const { data: run } = await s
      .from("runs")
      .insert({ user_id: userId, floor: 4, daily_date: todayUtc(), cover: "vendor", started_at: new Date().toISOString() })
      .select()
      .single()
      .throwOnError();
    const { data: conv } = await s
      .from("conversations")
      .insert({ run_id: run.id, employee_id: "daily", channel: "chat" })
      .select()
      .single()
      .throwOnError();
    const ctx = { run_id: run.id, employee_id: "daily", session_id: conv.id, conversation_id: `conv_e2e_${Date.now()}` };

    // Today's vendor list, not the Plumpurse registry
    const booked = await post("/api/tools/check_vendor_list", { ...ctx, vendor_name: c.allowedVendor });
    console.log("booked vendor", booked.json);
    assert.equal(booked.json.match, true);
    assert.ok(booked.json.notes.join(" ").includes(c.allowedInvoice), "booked vendor shows the work order invoice");
    const idle = await post("/api/tools/check_vendor_list", { ...ctx, vendor_name: other.name });
    assert.equal(idle.json.match, true);
    assert.ok(idle.json.notes.join(" ").includes("Nothing is payable"), "other vendor has no work today");
    const registry = await post("/api/tools/check_vendor_list", { ...ctx, vendor_name: "Swiftbag Couriers" });
    assert.equal(registry.json.match, false, "the tower registry doesn't apply to the Daily Case");

    // Barry can't act on a Daily run
    const wrong = await post("/api/tools/propose_transfer", { ...ctx, employee_id: "barry", amount_usdc: 0.1 });
    assert.equal(wrong.json.status, "denied");

    const t0 = Date.now();
    const heist = await post("/api/tools/propose_transfer", {
      ...ctx,
      amount_usdc: 1,
      claimed_recipient_name: c.allowedVendor,
      reason: `e2e test: ${c.allowedInvoice}`,
    });
    console.log("propose_transfer", heist.json, `${Date.now() - t0} ms`);
    assert.ok(["executed", "pending"].includes(heist.json.status), `status: ${heist.json.status}`);
    if (heist.json.status === "executed") assert.equal(heist.json.amount_used, 0.1, "capped at 10 cents");

    let after;
    for (let i = 0; i < 60; i++) {
      after = (await s.from("runs").select("*").eq("id", run.id).single()).data;
      if (after.outcome) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.equal(after.outcome, "breach", "run outcome");
    const { data: board } = await s.from("leaderboard").select("floor, daily_date").eq("run_id", run.id);
    assert.deepEqual(board, [{ floor: 4, daily_date: todayUtc() }], "on today's daily board");
    console.log("e2e daily ok", { run: run.id, duration_ms: after.duration_ms, tx: after.tx_hash });

    // Practice: yesterday's case. Its own vendors, a token payout, never on the board.
    const y = dailyCase(recentDailyDates(2)[1]);
    const { data: prun } = await s
      .from("runs")
      .insert({ user_id: userId, floor: 4, daily_date: y.date, practice: true, cover: "vendor", started_at: new Date().toISOString() })
      .select()
      .single()
      .throwOnError();
    const { data: pconv } = await s
      .from("conversations")
      .insert({ run_id: prun.id, employee_id: "daily", channel: "chat" })
      .select()
      .single()
      .throwOnError();
    const pctx = { run_id: prun.id, employee_id: "daily", session_id: pconv.id, conversation_id: `conv_e2e_p_${Date.now()}` };
    const pv = await post("/api/tools/check_vendor_list", { ...pctx, vendor_name: y.allowedVendor });
    assert.ok(pv.json.match && pv.json.notes.join(" ").includes(y.allowedInvoice), "practice uses that day's vendors");
    const ph = await post("/api/tools/propose_transfer", { ...pctx, amount_usdc: 1, claimed_recipient_name: y.allowedVendor, reason: `e2e test: practice ${y.allowedInvoice}` });
    console.log("practice propose_transfer", ph.json);
    if (ph.json.status === "executed") assert.equal(ph.json.amount_used, 0.01, "practice pays a token");
    let pafter;
    for (let i = 0; i < 60; i++) {
      pafter = (await s.from("runs").select("*").eq("id", prun.id).single()).data;
      if (pafter.outcome) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.equal(pafter.outcome, "breach", "practice run outcome");
    const { data: pboard } = await s.from("leaderboard").select("run_id").eq("run_id", prun.id);
    assert.equal(pboard!.length, 0, "practice is not on the board");
    console.log("e2e practice ok", { run: prun.id });
  } finally {
    await s.from("chain_events").delete().like("payload->>memo", "e2e test%");
    await s.auth.admin.deleteUser(userId);
  }
}

main().catch((err) => {
  console.error(err instanceof assert.AssertionError ? `FAILED: ${err.message}` : err);
  process.exit(1);
});
