import { z } from "zod";
import { db } from "@/server/chain/db";
import { brandedEmailEnabled, sendEmail, signInEmail } from "@/server/game/email";

const Body = z.object({
  email: z.email().max(200),
  handle: z.string().max(24).optional(),
  /** "magiclink": sign in by link. "signup": create an email + password account (the link confirms it). */
  kind: z.enum(["magiclink", "signup"]).default("magiclink"),
  password: z.string().min(8).max(72).optional(),
  next: z.string().max(200).optional(),
});

// Best effort per server instance: one email per address per minute, and a few per IP per hour.
const lastByEmail = new Map<string, number>();
const byIp = new Map<string, number[]>();

/**
 * POST /api/auth/link: sends our own branded sign-in (or sign-up confirmation) email. The link points at
 * /auth/confirm, which signs the player in and lands on /tower. Answers { fallback: true } when no email
 * key is set, and the client then uses Supabase's built-in email instead.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the email (and a password of 8+ characters)." }, { status: 400 });
  if (!brandedEmailEnabled()) return Response.json({ fallback: true });

  const { email, handle, kind, password } = parsed.data;
  const next = parsed.data.next?.startsWith("/") && !parsed.data.next.startsWith("//") ? parsed.data.next : "/tower";
  if (kind === "signup" && !password) return Response.json({ error: "Choose a password of 8+ characters." }, { status: 400 });

  const now = Date.now();
  const key = email.toLowerCase();
  if (now - (lastByEmail.get(key) ?? 0) < 60_000) return Response.json({ error: "We just sent one. Check your inbox, or try again in a minute." }, { status: 429 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const recent = (byIp.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= 8) return Response.json({ error: "Too many sign-in emails. Try again later." }, { status: 429 });

  const origin = new URL(req.url).origin;
  const { data, error } =
    kind === "signup"
      ? await db().auth.admin.generateLink({ type: "signup", email, password: password!, options: { data: { handle: handle?.trim() || undefined } } })
      : await db().auth.admin.generateLink({ type: "magiclink", email, options: { data: { handle: handle?.trim() || undefined } } });
  if (error || !data?.properties?.hashed_token) {
    const taken = /already|registered|exists/i.test(error?.message ?? "");
    return Response.json({ error: taken ? "That email already has an account. Sign in instead." : "Couldn't create the link. Try again." }, { status: taken ? 409 : 500 });
  }
  const link = `${origin}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=${kind}&next=${encodeURIComponent(next)}`;
  try {
    await sendEmail(email, signInEmail(link, handle?.trim() || null, kind));
  } catch {
    return Response.json({ error: "The email didn't send. Try again in a moment." }, { status: 502 });
  }
  lastByEmail.set(key, now);
  byIp.set(ip, [...recent, now]);
  return Response.json({ sent: true });
}
