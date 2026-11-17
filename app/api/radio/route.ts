import { randomUUID } from "node:crypto";
import { z } from "zod";
import agentIds from "@/agents/elevenlabs-ids.json";
import { db } from "@/server/chain/db";
import { getAgentSignedUrl, isStubMode, SessionError } from "@/server/game/session";

const Body = z.object({
  floor: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  run_id: z.uuid().optional(),
});

/** Each radio hint costs +30 s on the run clock in the UI (server penalty is out of scope). */
export const HINT_PENALTY_SECONDS = 30;

/**
 * POST /api/radio: open a text-only session with Krystal's hint line.
 * Not an employee session — increments runs.hints_used when a run_id is given.
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "bad request", issues: parsed.error.issues }, { status: 400 });
  }

  const agentId = (agentIds.agents as Record<string, string | undefined>).krystal;
  if (!agentId) {
    return Response.json({ error: "Krystal's radio isn't tuned yet" }, { status: 404 });
  }

  try {
    const signed_url = await getAgentSignedUrl(agentId);
    const session_id = randomUUID();
    const run_id = parsed.data.run_id;
    let hints_used = 0;

    if (run_id && !isStubMode()) {
      const { data: run } = await db()
        .from("runs")
        .select("hints_used")
        .eq("id", run_id)
        .maybeSingle()
        .throwOnError();
      if (!run) {
        return Response.json({ error: "run not found" }, { status: 404 });
      }
      hints_used = (run.hints_used ?? 0) + 1;
      await db().from("runs").update({ hints_used }).eq("id", run_id).throwOnError();
    } else if (run_id) {
      hints_used = 1; // stub: nothing persisted
    }

    return Response.json({
      signed_url,
      hints_used,
      hint_penalty_seconds: HINT_PENALTY_SECONDS,
      dynamic_variables: {
        floor: String(parsed.data.floor),
        run_id: run_id ?? "00000000-0000-0000-0000-000000000000",
        employee_id: "krystal",
        session_id,
        player_cover: "a hunter on Krystal's radio",
        memory: "(none)",
        daily_modifier: "(none)",
        talk_seconds_left: 600,
        open_proposal: "(none)",
        open_allowlist: "(none)",
      },
    });
  } catch (e) {
    if (e instanceof SessionError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
