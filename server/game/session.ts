// Starting a conversation with an employee: create the run and conversation rows, then get a
// signed ElevenLabs URL and the dynamic variables the agent and its tools need.
//
// STUB MODE: until Supabase keys are in .env.local, ids are generated in memory and nothing is
// stored. The ElevenLabs signed URL is real, so the chat itself works end to end.

import { randomUUID } from "node:crypto";
import agentIds from "@/agents/elevenlabs-ids.json";
import directory from "@/content/plumpurse/directory.json";
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

  const stub = isStubMode();
  // TODO(supabase): insert runs + conversations rows (service role) and read talk time used,
  // player memory and today's daily contract. Stub mode fakes all of it.
  const run_id = input.run_id ?? randomUUID();
  const session_id = randomUUID();
  const talk_seconds = TALK_SECONDS[input.employee_id];

  return {
    run_id,
    session_id,
    floor,
    signed_url: await signedUrl(agentId),
    dynamic_variables: {
      run_id,
      employee_id: input.employee_id,
      session_id,
      player_cover: input.cover.slice(0, 200) || "(no cover given)",
      memory: "(none)",
      daily_modifier: "(none)",
      talk_seconds_left: talk_seconds ?? 3600,
    },
    talk_seconds,
    stub,
  };
}
