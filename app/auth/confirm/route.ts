import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/server/game/auth";
import { ensureUserRow } from "@/server/game/players";

/** Landing for our branded email links: verify the one-time token, sign the player in, go to the lobby. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const nextParam = url.searchParams.get("next") ?? "/tower";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/tower";

  if (tokenHash && (type === "magiclink" || type === "signup" || type === "email")) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error && data.user) {
      const handle = typeof data.user.user_metadata?.handle === "string" ? data.user.user_metadata.handle : null;
      await ensureUserRow(data.user.id, handle?.slice(0, 24) || null);
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/signin?error=link", url.origin));
}
