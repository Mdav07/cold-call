// Creates or updates ElevenLabs agents from the rule sheets in agents/.
//
//   npx tsx --env-file=.env.local agents/sync.ts penny
//
// Env: ELEVENLABS_API_KEY (required). TOOLS_BASE_URL + TOOL_SHARED_SECRET attach the server
// tools (skipped with a warning if unset, so a persona can be chat-tested before A's routes exist).
// ELEVENLABS_LLM overrides the model. ELEVENLABS_VOICE_<EMPLOYEE> sets the voice.
// Ids (not secrets) are saved to agents/elevenlabs-ids.json so re-runs update instead of create.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const API = "https://api.elevenlabs.io/v1/convai";
const DIR = join(process.cwd(), "agents");
const IDS_FILE = join(DIR, "elevenlabs-ids.json");
const LLM = process.env.ELEVENLABS_LLM ?? "gemini-2.5-flash";

type Ids = { tools: Record<string, string>; agents: Record<string, string> };

// Which tools each employee gets. Floor 1 has no approve step (1-of-2 vault pays on propose).
const EMPLOYEE_TOOLS: Record<string, string[]> = {
  penny: ["check_vendor_list", "verify_employee", "check_calendar", "propose_transfer", "report_suspicion", "end_conversation"],
  dee: ["check_vendor_list", "verify_employee", "check_calendar", "propose_transfer", "report_suspicion", "end_conversation"],
};

// Filled by ElevenLabs from dynamic variables on every call; the LLM never sees or sets them.
const CONTEXT_PROPS = {
  run_id: { type: "string", dynamic_variable: "run_id" },
  employee_id: { type: "string", dynamic_variable: "employee_id" },
  session_id: { type: "string", dynamic_variable: "session_id" },
  conversation_id: { type: "string", dynamic_variable: "system__conversation_id" },
};

const s = (description: string) => ({ type: "string", description });
const n = (description: string) => ({ type: "number", description });

const TOOLS: Record<string, { description: string; props: Record<string, object>; required: string[] }> = {
  check_vendor_list: {
    description: "Look up a vendor in the Plumpurse approved vendor registry. Call before any payment.",
    props: { vendor_name: s("The vendor name exactly as the caller gave it") },
    required: ["vendor_name"],
  },
  verify_employee: {
    description: "Look up a person in the Plumpurse staff directory.",
    props: { name: s("The person's name as the caller said it") },
    required: ["name"],
  },
  check_calendar: {
    description: "Check a coworker's calendar and PTO for a date.",
    props: { person: s("The coworker's name"), date: s("Date as YYYY-MM-DD; use today's date if the caller means today") },
    required: ["person", "date"],
  },
  propose_transfer: {
    description: "Send a payment from your floor's vault to the caller's vendor. Only after the vendor checks out.",
    props: {
      amount_usdc: n("Amount in dollars, for example 4.5"),
      claimed_recipient_name: s("The vendor name as spelled in the registry"),
      reason: s("Short plain reason, for example 'Quillfeather invoice QF-2207, printer paper'"),
    },
    required: ["amount_usdc", "claimed_recipient_name", "reason"],
  },
  report_suspicion: {
    description: "Report a change in how suspicious you are of the caller, with the reason.",
    props: { delta: n("Change from -20 to 40"), reason: s("What raised or lowered your guard, in a few words") },
    required: ["delta", "reason"],
  },
  end_conversation: {
    description: "End the call: lockout, talk time over, or the conversation is done.",
    props: { reason: s("Why the call is ending") },
    required: ["reason"],
  },
};

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 800)}`);
  return text ? JSON.parse(text) : {};
}

function toolConfig(name: string, baseUrl: string, secret: string) {
  const t = TOOLS[name];
  return {
    type: "webhook",
    name,
    description: t.description,
    response_timeout_secs: 20,
    api_schema: {
      url: `${baseUrl.replace(/\/$/, "")}/api/tools/${name}`,
      method: "POST",
      request_headers: { "x-coldcall-tool-secret": secret },
      request_body_schema: {
        type: "object",
        required: [...Object.keys(CONTEXT_PROPS), ...t.required].filter((k) => k !== "conversation_id"),
        properties: { ...CONTEXT_PROPS, ...t.props },
      },
    },
  };
}

function buildPrompt(employee: string) {
  const sheet = readFileSync(join(DIR, `${employee}.md`), "utf8");
  const shared = readFileSync(join(DIR, "shared-rules.md"), "utf8");
  const first = sheet.match(/\*\*First message:\*\*\s*"([^"]+)"/);
  if (!first) throw new Error(`${employee}.md has no **First message:** line`);
  const body = sheet
    .split("\n")
    .filter((l) => !l.startsWith("**First message:**") && !l.startsWith("Rule sheet v"))
    .join("\n");
  return { prompt: `${body.trim()}\n\n${shared.trim()}\n`, firstMessage: first[1] };
}

async function main() {
  const employee = process.argv[2];
  if (!employee || !EMPLOYEE_TOOLS[employee]) throw new Error(`usage: agents/sync.ts <${Object.keys(EMPLOYEE_TOOLS).join("|")}>`);
  if (!process.env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not set (put it in .env.local)");

  const ids: Ids = existsSync(IDS_FILE) ? JSON.parse(readFileSync(IDS_FILE, "utf8")) : { tools: {}, agents: {} };
  const base = process.env.TOOLS_BASE_URL;
  const secret = process.env.TOOL_SHARED_SECRET;

  const toolIds: string[] = [];
  if (base && secret) {
    for (const name of EMPLOYEE_TOOLS[employee]) {
      const tool_config = toolConfig(name, base, secret);
      if (ids.tools[name]) {
        await api("PATCH", `/tools/${ids.tools[name]}`, { tool_config });
      } else {
        const created = await api("POST", "/tools", { tool_config });
        ids.tools[name] = created.id;
      }
      toolIds.push(ids.tools[name]);
      console.log(`tool ${name}: ${ids.tools[name]}`);
    }
  } else {
    console.warn("TOOLS_BASE_URL or TOOL_SHARED_SECRET unset: creating the agent without tools (persona test only).");
  }

  const { prompt, firstMessage } = buildPrompt(employee);
  const voice = process.env[`ELEVENLABS_VOICE_${employee.toUpperCase()}`];
  const conversation_config = {
    agent: {
      first_message: firstMessage,
      language: "en",
      prompt: { prompt, llm: LLM, tool_ids: toolIds, timezone: "America/Chicago" },
      dynamic_variables: {
        dynamic_variable_placeholders: {
          run_id: "00000000-0000-0000-0000-000000000000",
          employee_id: employee,
          session_id: "00000000-0000-0000-0000-000000000000",
          player_cover: "a caller with a request",
          memory: "(none)",
          daily_modifier: "(none)",
          talk_seconds_left: 600,
        },
      },
    },
    ...(voice ? { tts: { voice_id: voice } } : {}),
  };
  const platform_settings = {
    // Private agent: sessions start only with a signed URL from our backend.
    auth: { enable_auth: true },
    // Lets a session switch to text-only chat at start (same agent for chat and voice).
    overrides: { conversation_config_override: { conversation: { text_only: true } } },
  };

  const name = `Cold Call · ${employee}`;
  if (ids.agents[employee]) {
    await api("PATCH", `/agents/${ids.agents[employee]}`, { name, conversation_config, platform_settings });
    console.log(`updated agent ${employee}: ${ids.agents[employee]}`);
  } else {
    const created = await api("POST", "/agents/create", { name, tags: ["coldcall"], conversation_config, platform_settings });
    ids.agents[employee] = created.agent_id;
    console.log(`created agent ${employee}: ${created.agent_id}`);
  }
  writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2) + "\n");
  if (!voice) console.warn(`No ELEVENLABS_VOICE_${employee.toUpperCase()} set: the agent uses the default voice.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
