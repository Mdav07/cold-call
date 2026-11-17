import { z } from "zod";
import { db } from "@/server/chain/db";
import { signedInUserId } from "@/server/game/auth";
import { cleanName } from "@/app/play/hunters";

const Body = z.object({ name: z.string().max(40) });

/** POST /api/hunter: a signed-in player's hunter name becomes their leaderboard name. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const name = cleanName(parsed.data.name);
  if (!name) return Response.json({ error: "empty name" }, { status: 400 });

  const userId = await signedInUserId();
  // Anonymous players share the demo account; their name stays in their browser only.
  if (!userId) return Response.json({ saved: "local" });

  await db().from("users").update({ display_name: name }).eq("id", userId).throwOnError();
  return Response.json({ saved: "account" });
}
