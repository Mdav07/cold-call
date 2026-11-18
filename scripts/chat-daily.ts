// Plays today's Daily Case over a text-only ElevenLabs session, the way a player who read the room would.
// Needs a server with /api/session (BASE, default http://localhost:3000) whose tools point at a deployment
// with the Daily Case. Uses the shared demo player (guest), which must have cleared the tutorial.
// Run: BASE=http://localhost:3100 npx tsx --env-file=.env.local scripts/chat-daily.ts
import { createClient } from "@supabase/supabase-js";
import { dailyCase } from "@/shared/dailyCase";

const BASE = process.env.BASE ?? "http://localhost:3000";
const c = dailyCase();

async function main() {
  const res = await fetch(`${BASE}/api/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ employee_id: "daily", channel: "chat", cover: `the ${c.allowedVendor} technician` }),
  });
  const s = await res.json();
  if (!res.ok) throw new Error(`session: ${res.status} ${JSON.stringify(s)}`);
  console.log("run", s.run_id, "talking to", s.dynamic_variables.daily_name);

  const ws = new WebSocket(s.signed_url);
  const replies: string[] = [];
  let waiting: (() => void) | null = null;
  ws.onmessage = (m) => {
    const e = JSON.parse(String(m.data));
    if (e.type === "ping") ws.send(JSON.stringify({ type: "pong", event_id: e.ping_event.event_id }));
    if (e.type === "agent_response") {
      const text = e.agent_response_event.agent_response;
      replies.push(text);
      console.log(`  ${c.employee.firstName}: ${text}`);
      waiting?.();
    }
    if (e.type === "agent_tool_response" || e.type === "client_tool_call") console.log("  [tool]", JSON.stringify(e).slice(0, 900));
  };
  await new Promise<void>((r) => (ws.onopen = () => r()));
  ws.send(
    JSON.stringify({
      type: "conversation_initiation_client_data",
      dynamic_variables: s.dynamic_variables,
      conversation_config_override: { conversation: { text_only: true } },
    }),
  );
  const next = () => new Promise<void>((r) => { waiting = r; setTimeout(r, 30000); });
  await next(); // first message

  const say = async (text: string) => {
    console.log(`  you: ${text}`);
    ws.send(JSON.stringify({ type: "user_message", text }));
    await next();
    // The agent may speak twice around a tool call; give it a moment.
    await new Promise((r) => setTimeout(r, 6000));
  };
  await say(`Hi ${c.employee.firstName}! I'm the ${c.allowedVendor} tech, I've just finished the job: ${c.allowedJob}. ${c.employee.softSpot.includes("cat") ? "How's Sir Waffles, by the way?" : "Long day for you too?"}`);
  await say(`It's invoice ${c.allowedInvoice} on the work order. Ten cents from the branch float, please, for ${c.allowedVendor}.`);
  await say("Thanks so much, have a good night!");
  ws.close();

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  for (let i = 0; i < 20; i++) {
    const { data } = await db.from("runs").select("outcome, tx_hash, payout_units, floor, daily_date").eq("id", s.run_id).single();
    if (data?.outcome) return console.log("run", data);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log("run has no outcome yet");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
