// Starting a conversation with an employee: create the run and conversation rows, then get a
// signed ElevenLabs URL and the dynamic variables the agent and its tools need.
//
// STUB MODE: until Supabase keys are in .env.local, ids are generated in memory and nothing is
// stored. The ElevenLabs signed URL is real, so the chat itself works end to end.

import { randomUUID } from "node:crypto";
import agentIds from "@/agents/elevenlabs-ids.json";
import directory from "@/content/plumpurse/directory.json";
import { db } from "@/server/chain/db";
import { onRunEnded } from "@/server/chain/ingest";
import { signedInUserId } from "@/server/game/auth";
import { getDemoUserId } from "@/server/game/players";
import { recordTalkTime } from "@/server/game/suspicion";
import { MEMORY_LINES, writeConversationMemory } from "@/server/game/memory";
import type { Channel, EmployeeId, FloorId } from "@/shared/interfaces";

/** Talk time per employee in seconds; null = unlimited (design doc, "Talk time by rank"). */
export const TALK_SECONDS: Record<EmployeeId, number | null> = {
  barry: null,
  penny: null,
  dee: null,
  annie: 300,
  bill: 300,
  cassius: 180,
  max: 120,
};

export interface StartSessionInput {
  employee_id: EmployeeId;
  channel: Channel;
  cover: string;
  run_id?: string; // continue a run (call-backs, the floor-mate)
  ip?: string | null; // for the per-IP daily run limit
}

const RUNS_PER_USER = Number(process.env.RUNS_PER_USER_PER_DAY ?? 10);
const RUNS_PER_IP = Number(process.env.RUNS_PER_IP_PER_DAY ?? 30);
const VOICE_SECONDS_PER_DAY = Number(process.env.VOICE_MINUTES_PER_USER_PER_DAY ?? 15) * 60;

/** Abuse limits (spec decision 14): runs per player and per IP per day, voice minutes per player per day. */
async function checkLimits(userId: string, ip: string | null | undefined, channel: Channel, newRun: boolean, shared: boolean) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const day = since.toISOString();

  // The shared demo player stands for every anonymous visitor: limit it by IP, not as one person.
  if (newRun && !shared) {
    const { count: mine } = await db()
      .from("runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", day)
      .throwOnError();
    if ((mine ?? 0) >= RUNS_PER_USER) {
      throw new SessionError(`That's ${RUNS_PER_USER} runs today. Krystal says rest up and come back tomorrow.`, 429);
    }
  }
  if (newRun) {
    if (ip) {
      const { count: fromIp } = await db()
        .from("runs")
        .select("id", { count: "exact", head: true })
        .eq("client_ip", ip)
        .gte("created_at", day)
        .throwOnError();
      if ((fromIp ?? 0) >= RUNS_PER_IP) throw new SessionError("Too many runs from this network today.", 429);
    }
  }

  if (channel === "voice" && !shared) {
    const { data: runs } = await db().from("runs").select("id").eq("user_id", userId).gte("created_at", day).throwOnError();
    const ids = (runs ?? []).map((r) => r.id);
    if (ids.length) {
      const { data: calls } = await db()
        .from("conversations")
        .select("seconds_used")
        .in("run_id", ids)
        .eq("channel", "voice")
        .throwOnError();
      const used = (calls ?? []).reduce((s, c) => s + (c.seconds_used ?? 0), 0);
      if (used >= VOICE_SECONDS_PER_DAY) {
        throw new SessionError("You've used today's call minutes. You can still message the staff in chat.", 429);
      }
    }
  }
}

export interface StartSessionResult {
  run_id: string;
  session_id: string;
  floor: FloorId;
  signed_url: string;
  dynamic_variables: Record<string, string | number>;
  talk_seconds: number | null;
  stub: boolean;
}

export class SessionError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export function isStubMode(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function employeeFloor(id: EmployeeId): FloorId {
  const e = directory.employees.find((x) => x.id === id);
  if (!e || !e.is_signer) throw new SessionError(`unknown employee ${id}`, 404);
  return e.floor as FloorId;
}

export function agentIdFor(id: EmployeeId): string | null {
  return (agentIds.agents as Record<string, string | undefined>)[id] ?? null;
}

async function signedUrl(agentId: string): Promise<string> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new SessionError("ELEVENLABS_API_KEY is not set", 500);
  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
    { headers: { "xi-api-key": key }, cache: "no-store" },
  );
  if (!res.ok) throw new SessionError(`ElevenLabs signed URL failed (${res.status})`, 502);
  return (await res.json()).signed_url as string;
}

/** Signed URL for any ConvAI agent id (employees via startSession; Krystal via /api/radio). */
export async function getAgentSignedUrl(agentId: string): Promise<string> {
  return signedUrl(agentId);
}

export async function startSession(input: StartSessionInput): Promise<StartSessionResult> {
  // Krystal is the radio mentor, not a staff signer — use POST /api/radio instead.
  if ((input.employee_id as string) === "krystal") {
    throw new SessionError("Krystal isn't on staff. Tune into the radio instead.", 400);
  }
  const floor = employeeFloor(input.employee_id);
  const agentId = agentIdFor(input.employee_id);
  if (!agentId) throw new SessionError(`${input.employee_id} has no ElevenLabs agent yet`, 404);

  // Signed URL first, so a missing key or an ElevenLabs outage leaves no orphan rows behind.
  const signed_url = await signedUrl(agentId);
  const stub = isStubMode();
  const cover = input.cover.slice(0, 200) || "(no cover given)";
  const talkBudget = TALK_SECONDS[input.employee_id];

  let run_id: string;
  let session_id: string;
  let memory = "(none)";
  let daily_modifier = "(none)";
  let open_proposal = "(none)";
  let open_allowlist = "(none)";
  let talk_seconds = talkBudget;

  if (stub) {
    run_id = input.run_id ?? randomUUID();
    session_id = randomUUID();
  } else {
    // Signed-in player; the shared demo player only when nobody is signed in (and allowed).
    let userId = await signedInUserId();
    const shared = !userId;
    if (!userId) {
      if (process.env.ALLOW_DEMO_PLAYER === "false") throw new SessionError("Sign in to play", 401);
      userId = await getDemoUserId();
    }
    await checkLimits(userId, input.ip, input.channel, !input.run_id, shared);
    run_id = input.run_id
      ? await continueRun(input.run_id, userId, floor)
      : await newRun(userId, floor, cover, input.channel, input.ip ?? null);

    const { data: conv } = await db()
      .from("conversations")
      .insert({ run_id, employee_id: input.employee_id, channel: input.channel })
      .select("id")
      .single()
      .throwOnError();
    session_id = conv.id;
    if (input.channel === "voice") {
      // A run that used voice at all counts as voice on the leaderboard.
      await db().from("runs").update({ channel: "voice" }).eq("id", run_id).throwOnError();
    }

    // Only tricks from earlier runs: a callback on this run (Floor 3's allowlist, wait, call back)
    // is the designed path, not a repeated trick.
    const { data: thisRun } = await db().from("runs").select("created_at").eq("id", run_id).single().throwOnError();
    const { data: mem } = await db()
      .from("player_memory")
      .select("trick_summary")
      .eq("user_id", userId)
      .eq("employee_id", input.employee_id)
      .lt("created_at", thisRun.created_at)
      .order("created_at", { ascending: false })
      .limit(MEMORY_LINES)
      .throwOnError();
    if (mem?.length) memory = [...mem].reverse().map((m) => `- ${m.trick_summary}`).join("\n");

    const today = new Date().toISOString().slice(0, 10);
    const { data: daily } = await db()
      .from("daily_contracts")
      .select("floor, modifier")
      .eq("date", today)
      .maybeSingle()
      .throwOnError();
    if (daily && daily.floor === floor) daily_modifier = daily.modifier;

    // The second signer on a 2-of-2 floor needs the request number to review it.
    const { data: open } = await db()
      .from("proposals")
      .select("onchain_id, amount_units, claimed_name")
      .eq("run_id", run_id)
      .eq("kind", "transfer")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .throwOnError();
    if (open) {
      const dollars = open.amount_units != null ? Number(open.amount_units) / 1_000_000 : null;
      open_proposal = `Request #${open.onchain_id}: ${dollars ?? "?"} dollars to ${open.claimed_name ?? "an unnamed vendor"}, waiting for a second signature.`;
    }

    // Floor 3: the allowlist add the other executive started, and when its security wait ends.
    if (floor === 3) {
      const { data: al } = await db()
        .from("proposals")
        .select("onchain_id, status, claimed_name, unlock_at")
        .eq("run_id", run_id)
        .eq("kind", "allowlist")
        .in("status", ["open", "queued", "added"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .throwOnError();
      if (al) {
        const who = al.claimed_name ?? "the caller";
        if (al.status === "open") {
          open_allowlist = `Allowlist request #${al.onchain_id} for ${who}: waiting for the second executive's approval.`;
        } else if (al.status === "queued" && al.unlock_at && Date.parse(al.unlock_at) > Date.now()) {
          const secs = Math.ceil((Date.parse(al.unlock_at) - Date.now()) / 1000);
          open_allowlist = `Allowlist request #${al.onchain_id} for ${who}: approved by both executives, in the security wait for about ${secs} more seconds. A payment can't be proposed until it ends.`;
        } else {
          open_allowlist = `Allowlist request #${al.onchain_id} for ${who}: the security wait is over. A payment to ${who} can be proposed now.`;
        }
      }
    }

    if (talkBudget != null) {
      const { data: used } = await db()
        .from("conversations")
        .select("seconds_used")
        .eq("run_id", run_id)
        .eq("employee_id", input.employee_id)
        .throwOnError();
      const spent = (used ?? []).reduce((sum, r) => sum + (r.seconds_used ?? 0), 0);
      talk_seconds = Math.max(0, talkBudget - spent);
      if (talk_seconds === 0) throw new SessionError("No talk time left with this employee on this run", 409);
    }
  }

  return {
    run_id,
    session_id,
    floor,
    signed_url,
    dynamic_variables: {
      run_id,
      employee_id: input.employee_id,
      session_id,
      player_cover: cover,
      memory,
      daily_modifier,
      talk_seconds_left: talk_seconds ?? 3600,
      open_proposal,
      open_allowlist,
    },
    talk_seconds,
    stub,
  };
}

async function newRun(userId: string, floor: FloorId, cover: string, channel: Channel, ip: string | null): Promise<string> {
  // Floors open in order, as on /tower: 0 and 1 are always open; floor N needs a breach on floor N-1.
  // Checked before anything else so a refused request leaves the player's current run alone.
  if (floor >= 2) {
    const { count } = await db()
      .from("runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("floor", floor - 1)
      .eq("outcome", "breach")
      .throwOnError();
    if (!count) throw new SessionError(`Floor ${floor} is locked. Clear Floor ${floor - 1} first.`, 403);
  }

  // A new run closes the player's unfinished ones as "quit" (and clears any Floor 3 allowlist spot).
  const { data: stale } = await db()
    .from("runs")
    .update({ outcome: "quit", ended_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("ended_at", null)
    .select("id")
    .throwOnError();
  for (const r of stale ?? []) await onRunEnded(r.id);

  const { data } = await db()
    .from("runs")
    .insert({ user_id: userId, floor, cover, channel, client_ip: ip })
    .select("id")
    .single()
    .throwOnError();
  return data.id;
}

async function continueRun(runId: string, userId: string, floor: FloorId): Promise<string> {
  const { data } = await db()
    .from("runs")
    .select("id, user_id, floor, ended_at")
    .eq("id", runId)
    .maybeSingle()
    .throwOnError();
  if (!data || data.user_id !== userId) throw new SessionError("run not found", 404);
  if (data.ended_at) throw new SessionError("that run is over", 409);
  if (data.floor !== floor) throw new SessionError("that employee is on another floor", 400);
  return data.id;
}

/** Called on the player's first message: starts the run clock and binds the ElevenLabs id. */
export async function bindSession(input: {
  run_id: string;
  session_id: string;
  conversation_id?: string;
  first_message?: boolean;
  ended?: boolean;
}): Promise<void> {
  if (isStubMode()) return;
  if (input.ended) {
    await recordTalkTime(input.session_id);
    await writeConversationMemory(input.session_id);
  }
  if (input.conversation_id) {
    await db()
      .from("conversations")
      .update({ elevenlabs_conversation_id: input.conversation_id })
      .eq("id", input.session_id)
      .eq("run_id", input.run_id)
      .throwOnError();
  }
  if (input.first_message) {
    // Only the first message of the run sets it (call-backs keep the original start).
    await db()
      .from("runs")
      .update({ started_at: new Date().toISOString() })
      .eq("id", input.run_id)
      .is("started_at", null)
      .throwOnError();
  }
}
