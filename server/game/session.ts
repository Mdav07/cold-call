// Starting a conversation with an employee: create the run and conversation rows, then get a
// signed ElevenLabs URL and the dynamic variables the agent and its tools need.
//
// STUB MODE: until Supabase keys are in .env.local, ids are generated in memory and nothing is
// stored. The ElevenLabs signed URL is real, so the chat itself works end to end.

import { randomUUID } from "node:crypto";
import agentIds from "@/agents/elevenlabs-ids.json";
import directory from "@/content/plumpurse/directory.json";
import { db } from "@/server/chain/db";
import { signedInUserId } from "@/server/game/auth";
import { getDemoUserId } from "@/server/game/players";
import { recordTalkTime } from "@/server/game/suspicion";
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

export async function startSession(input: StartSessionInput): Promise<StartSessionResult> {
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
  let talk_seconds = talkBudget;

  if (stub) {
    run_id = input.run_id ?? randomUUID();
    session_id = randomUUID();
  } else {
    // Signed-in player; the shared demo player only when nobody is signed in (and allowed).
    let userId = await signedInUserId();
    if (!userId) {
      if (process.env.ALLOW_DEMO_PLAYER === "false") throw new SessionError("Sign in to play", 401);
      userId = await getDemoUserId();
    }
    run_id = input.run_id ? await continueRun(input.run_id, userId, floor) : await newRun(userId, floor, cover, input.channel);

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

    const { data: mem } = await db()
      .from("player_memory")
      .select("trick_summary")
      .eq("user_id", userId)
      .eq("employee_id", input.employee_id)
      .order("created_at", { ascending: true })
      .throwOnError();
    if (mem?.length) memory = mem.map((m) => `- ${m.trick_summary}`).join("\n");

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
    },
    talk_seconds,
    stub,
  };
}

async function newRun(userId: string, floor: FloorId, cover: string, channel: Channel): Promise<string> {
  const { data } = await db()
    .from("runs")
    .insert({ user_id: userId, floor, cover, channel })
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
  if (input.ended) await recordTalkTime(input.session_id);
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
