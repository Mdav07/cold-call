import { z } from "zod";
import { bindSession } from "@/server/game/session";

const Body = z.object({
  run_id: z.uuid(),
  session_id: z.uuid(),
  conversation_id: z.string().max(100).optional(),
  first_message: z.boolean().optional(),
  started_at_ms: z.number().int().positive().optional(),
  ended: z.boolean().optional(),
});

/** POST /api/session/bind: store the ElevenLabs conversation id and start the run clock. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  await bindSession(parsed.data);
  return Response.json({ ok: true });
}
