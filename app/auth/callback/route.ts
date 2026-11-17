import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/server/game/auth";
import { ensureUserRow } from "@/server/game/players";

/** Magic-link landing: exchange the code for a session, create the player, go to `next`. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/play/penny";
  // Only same-site paths, so the link can't bounce players to another site.
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/play/penny";

  if (code) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const handle = typeof data.user.user_metadata?.handle === "string" ? data.user.user_metadata.handle : null;
      await ensureUserRow(data.user.id, handle?.slice(0, 24) || null);
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/signin?error=link", url.origin));
}
