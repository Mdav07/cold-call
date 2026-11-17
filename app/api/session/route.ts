import { z } from "zod";
import { SessionError, startSession } from "@/server/game/session";

const Body = z.object({
  employee_id: z.enum(["barry", "penny", "dee", "annie", "bill", "cassius", "max"]),
  channel: z.enum(["chat", "voice"]).default("chat"),
  cover: z.string().max(200).default(""),
  run_id: z.uuid().optional(),
});

/** POST /api/session: start a chat or call with one employee. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "bad request", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    return Response.json(await startSession(parsed.data));
  } catch (e) {
    if (e instanceof SessionError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
