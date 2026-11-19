import { z } from "zod";
import { SessionError, startSession } from "@/server/game/session";

const Body = z.object({
  employee_id: z.enum(["barry", "penny", "dee", "annie", "bill", "cassius", "max", "daily"]),
  channel: z.enum(["chat", "voice"]).default("chat"),
  cover: z.string().max(200).default(""),
  run_id: z.uuid().optional(),
  // The Daily Case: which day's case (today, or up to 6 days back as practice).
  daily_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** POST /api/session: start a chat or call with one employee. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "bad request", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    // First hop of x-forwarded-for is the client on Vercel; only a well-formed IP is stored.
    const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ip = fwd && /^[0-9a-fA-F:.]{3,45}$/.test(fwd) ? fwd : null;
    return Response.json(await startSession({ ...parsed.data, ip }));
  } catch (e) {
    if (e instanceof SessionError) return Response.json({ error: e.message }, { status: e.status });
    // Anything else: log it, and still answer with JSON so the player sees a message, not a parse error.
    console.error("POST /api/session failed", e);
    return Response.json({ error: "Couldn't reach them just now. Try again in a moment." }, { status: 500 });
  }
}
