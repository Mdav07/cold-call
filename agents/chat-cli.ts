// Text-chat with an employee agent from the terminal, through the same path the app uses:
// a signed URL from our key, then a text-only WebSocket session with dynamic variables.
//
//   npx tsx --env-file=.env.local agents/chat-cli.ts penny "Hi Penny" "Second line" ...
//
// Each argument after the employee is one player message, sent after the agent replies.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const employee = process.argv[2];
const lines = process.argv.slice(3);
const ids = JSON.parse(readFileSync(join(process.cwd(), "agents", "elevenlabs-ids.json"), "utf8"));
const agentId: string | undefined = ids.agents[employee];
if (!agentId) throw new Error(`no agent id for ${employee}; run agents/sync.ts first`);

async function signedUrl(): Promise<string> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
    { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! } },
  );
  if (!res.ok) throw new Error(`signed url -> ${res.status}: ${await res.text()}`);
  return (await res.json()).signed_url;
}

// SESSION_URL=http://localhost:3000 uses the app's real /api/session (real run + conversation
// rows, so the server tools pass their checks). Without it, ids are fake (persona tests only).
const SESSION_URL = process.env.SESSION_URL;
let dynamicVariables: Record<string, string | number> = {
  run_id: "00000000-0000-0000-0000-000000000000",
  employee_id: employee,
  session_id: "00000000-0000-0000-0000-000000000000",
  player_cover: "a vendor calling about an invoice",
  memory: "(none)",
  daily_modifier: "(none)",
  talk_seconds_left: 600,
};

async function realSession(): Promise<string> {
  const res = await fetch(`${SESSION_URL}/api/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ employee_id: employee, cover: "Sam from Quillfeather Supplies" }),
  });
  const s = await res.json();
  if (!res.ok) throw new Error(`session -> ${res.status}: ${JSON.stringify(s)}`);
  dynamicVariables = s.dynamic_variables;
  console.log(`[run ${s.run_id} session ${s.session_id}]`);
  const bind = (extra: object) =>
    fetch(`${SESSION_URL}/api/session/bind`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ run_id: s.run_id, session_id: s.session_id, ...extra }),
    });
  await bind({ first_message: true });
  return s.signed_url;
}

async function main() {
  const ws = new WebSocket(SESSION_URL ? await realSession() : await signedUrl());
  let i = 0;
  const sendNext = () => {
    if (i >= lines.length) return setTimeout(() => ws.close(), 1500);
    const text = lines[i++];
    console.log(`\nPLAYER: ${text}`);
    ws.send(JSON.stringify({ type: "user_message", text }));
  };

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        type: "conversation_initiation_client_data",
        conversation_config_override: { conversation: { text_only: true } },
        dynamic_variables: dynamicVariables,
      }),
    );
  };

  ws.onmessage = (ev) => {
    const msg = JSON.parse(String(ev.data));
    switch (msg.type) {
      case "conversation_initiation_metadata":
        console.log(`[session ${msg.conversation_initiation_metadata_event?.conversation_id}]`);
        break;
      case "agent_response":
        console.log(`${employee.toUpperCase()}: ${msg.agent_response_event?.agent_response}`);
        setTimeout(sendNext, 300);
        break;
      case "client_tool_call":
      case "agent_tool_request":
      case "agent_tool_response":
        console.log(`[tool] ${JSON.stringify(msg).slice(0, 300)}`);
        break;
      case "ping":
        ws.send(JSON.stringify({ type: "pong", event_id: msg.ping_event?.event_id }));
        break;
      case "error":
        console.error(`[error] ${JSON.stringify(msg)}`);
        break;
    }
  };
  ws.onclose = (ev) => console.log(`\n[closed ${ev.code}${ev.reason ? `: ${ev.reason}` : ""}]`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
