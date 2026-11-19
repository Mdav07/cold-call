// Per-player memory ("patching"): when a call ends, write one line about the trick the player
// used on that employee. The next session with that employee gets these lines as {{memory}}, so
// the employee recognizes a repeated trick. Built from the employee's own suspicion reasons
// (what lowered their guard), the vendor or firm involved and whether money moved, so it costs no
// extra model call and can't invent anything.
//
// What gets recognized is the *story* (the name-drop, excuse or evidence that won them over), not
// the vendor: each floor has one booked vendor or firm, so a replay has to reuse it with a new angle.
//
// Guests all share one demo account, so a guest's lines carry a key from their network address and
// only that guest is reminded of them; otherwise one judge's win would block the next judge's route.

import { createHash } from "node:crypto";
import { db } from "@/server/chain/db";
import { getDemoUserId } from "@/server/game/players";

/** How many past tricks an employee is reminded of (newest last). */
export const MEMORY_LINES = 5;
/** An employee you already fooled starts warier: this much per remembered win, up to the max. */
export const REMEMBERED_WIN_SUSPICION = 10;
export const REMEMBERED_WIN_MAX = 10;
/** The cover a session gets when the player hasn't typed one (server/game/session.ts). */
const PLACEHOLDER_COVER = "not said yet";
const WON = "it worked:";

/** Scope for a player's memory: the user, plus a per-device key for the shared guest account. */
export async function memoryScope(userId: string, ip: string | null | undefined): Promise<{ userId: string; guestKey: string | null }> {
  const guest = userId === (await getDemoUserId().catch(() => null));
  if (!guest) return { userId, guestKey: null };
  const key = createHash("sha256").update(ip || "unknown").digest("hex").slice(0, 10);
  return { userId, guestKey: `[guest:${key}] ` };
}

/** The remembered lines for this player and employee, from runs before `before` (oldest first). */
export async function rememberedLines(
  scope: { userId: string; guestKey: string | null },
  employee: string,
  before: string,
  limit = MEMORY_LINES,
): Promise<string[]> {
  let q = db()
    .from("player_memory")
    .select("trick_summary")
    .eq("user_id", scope.userId)
    .eq("employee_id", employee)
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (scope.guestKey) q = q.like("trick_summary", `${scope.guestKey.replace(/[[\]]/g, "\\$&")}%`);
  const { data } = await q.throwOnError();
  return [...(data ?? [])].reverse().map((m) => (scope.guestKey ? m.trick_summary.slice(scope.guestKey.length) : m.trick_summary));
}

/** How many remembered lines record a trick that actually worked (lowered their guard or moved money). */
export const rememberedWins = (lines: string[]) =>
  lines.filter((l) => l.includes(WON) || l.includes("won me over with") || l.includes("got a payment request")).length; // older lines too

export async function writeConversationMemory(sessionId: string): Promise<string | null> {
  const { data: conv } = await db()
    .from("conversations")
    .select("run_id, employee_id, created_at")
    .eq("id", sessionId)
    .maybeSingle()
    .throwOnError();
  if (!conv) return null;

  const [{ data: run }, { data: events }, { data: proposals }] = await Promise.all([
    db().from("runs").select("user_id, cover, outcome, floor, client_ip").eq("id", conv.run_id).maybeSingle().throwOnError(),
    db()
      .from("suspicion_events")
      .select("delta, reason")
      .eq("run_id", conv.run_id)
      .eq("employee_id", conv.employee_id)
      .gte("created_at", conv.created_at)
      .order("created_at")
      .throwOnError(),
    db()
      .from("proposals")
      .select("kind, status, claimed_name")
      .eq("run_id", conv.run_id)
      .gte("created_at", conv.created_at)
      .throwOnError(),
  ]);
  if (!run) return null;
  // Pocket Branch is practice: never store tricks, so Barry always treats the player as new.
  if (run.floor === 0) return null;

  const lowered = (events ?? []).filter((e) => e.delta < 0).map((e) => e.reason.trim().replace(/\.$/, ""));
  const raised = (events ?? []).filter((e) => e.delta > 0).map((e) => e.reason.trim().replace(/\.$/, ""));
  const moved = (proposals ?? []).find((p) => p.kind === "transfer");
  const allowlisted = (proposals ?? []).find((p) => p.kind === "allowlist");

  // Nothing happened on this call: nothing worth remembering.
  if (!lowered.length && !raised.length && !moved && !allowlisted) return null;

  const unique = (xs: string[]) => [...new Set(xs.map((x) => x.toLowerCase()))].slice(0, 3);
  // Lead with the story that worked: that's what the employee must recognize next time.
  const parts: string[] = [];
  if (lowered.length || moved || allowlisted) {
    parts.push(`${WON} ${lowered.length ? unique(lowered).join("; ") : "they talked me into it"}`);
  } else {
    parts.push(`tried and failed: ${unique(raised).join("; ")}`);
  }
  const cover = run.cover && !run.cover.startsWith(PLACEHOLDER_COVER) ? run.cover : null;
  if (cover) parts.push(`they said they were "${cover}"`);
  if (moved) parts.push(`I put in a payment to "${moved.claimed_name ?? "a vendor"}" (${moved.status})`);
  if (allowlisted) parts.push(`I started an allowlist add for "${allowlisted.claimed_name ?? "a firm"}"`);
  const scope = await memoryScope(run.user_id, run.client_ip);
  const line = `${scope.guestKey ?? ""}${parts.join("; ")}`.slice(0, 420);

  await db()
    .from("player_memory")
    .insert({ user_id: run.user_id, employee_id: conv.employee_id, trick_summary: line })
    .throwOnError();
  return line;
}

// ---------- Recognizing a repeated trick (enforced on the server, not left to the model) ----------

/** Case evidence the player needs to win (vendor, invoice, memo, introduction): never a "repeat". */
const EVIDENCE = /invoice|vendor|registry|on the list|format|memo|notice|on file|calendar|verified|checks? out|introduc|matches|evidence|payment|allowlist|booked|work order/i;
/** A repeated rapport trick costs this much instead of lowering suspicion (below the grudge line). */
export const REPEAT_TRICK_DELTA = 25;

// Words that name the kind of trick, not the trick itself: two different compliments aren't a repeat.
const GENERIC = new Set(
  "about after again also and are being caller compliment compliments complimented flattery for from genuine gossip her him his insider kind mention mentioned nice office praise praised real shows small specific talk that the their them they this very what with work".split(" "),
);
const words = (t: string) => new Set((t.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((w) => !GENERIC.has(w)));

/** The rapport phrases (compliments, gossip, flattery, name-drops) that already worked, from memory lines. */
export function rememberedRapport(lines: string[]): string[] {
  const out: string[] = [];
  for (const l of lines) {
    const m = l.match(/(?:it worked:|won me over with:)\s*([^]*)/i);
    if (!m) continue;
    // Stop at the parts the line adds after the trick itself.
    const trick = m[1].split(/; (?:they said|I put in|I started|got a payment|got ")/)[0];
    for (const p of trick.split(";").map((x) => x.trim()).filter(Boolean)) if (!EVIDENCE.test(p)) out.push(p);
  }
  return out;
}

/** True when a new guard-lowering reason is the same rapport trick as a remembered one. */
export function isRepeatTrick(reason: string, remembered: string[]): boolean {
  if (EVIDENCE.test(reason)) return false;
  const a = words(reason);
  if (a.size < 1) return false;
  return remembered.some((r) => {
    const b = words(r);
    const shared = [...a].filter((w) => b.has(w)).length;
    return b.size > 0 && shared >= Math.min(2, b.size) && shared / Math.min(a.size, b.size) >= 0.5;
  });
}

