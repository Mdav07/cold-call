// Per-player memory ("patching"): when a call ends, write one line about the trick the player
// used on that employee. The next session with that employee gets these lines as {{memory}}, so
// the employee recognizes a repeated trick. Built from the employee's own suspicion reasons
// (what lowered their guard), the player's cover story and whether money moved, so it costs no
// extra model call and can't invent anything.

import { db } from "@/server/chain/db";

/** How many past tricks an employee is reminded of (newest last). */
export const MEMORY_LINES = 5;

export async function writeConversationMemory(sessionId: string): Promise<string | null> {
  const { data: conv } = await db()
    .from("conversations")
    .select("run_id, employee_id, created_at")
    .eq("id", sessionId)
    .maybeSingle()
    .throwOnError();
  if (!conv) return null;

  const [{ data: run }, { data: events }, { data: proposals }] = await Promise.all([
    db().from("runs").select("user_id, cover, outcome").eq("id", conv.run_id).maybeSingle().throwOnError(),
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

  const lowered = (events ?? []).filter((e) => e.delta < 0).map((e) => e.reason.trim().replace(/\.$/, ""));
  const raised = (events ?? []).filter((e) => e.delta > 0).map((e) => e.reason.trim().replace(/\.$/, ""));
  const moved = (proposals ?? []).find((p) => p.kind === "transfer");
  const allowlisted = (proposals ?? []).find((p) => p.kind === "allowlist");

  // Nothing happened on this call: nothing worth remembering.
  if (!lowered.length && !raised.length && !moved && !allowlisted) return null;

  const unique = (xs: string[]) => [...new Set(xs.map((x) => x.toLowerCase()))].slice(0, 3);
  const parts = [`Claimed to be ${run.cover ? `"${run.cover}"` : "someone unnamed"}`];
  if (lowered.length) parts.push(`won me over with: ${unique(lowered).join("; ")}`);
  if (moved) parts.push(`got a payment request for "${moved.claimed_name ?? "a vendor"}" (${moved.status})`);
  if (allowlisted) parts.push(`got "${allowlisted.claimed_name ?? "a firm"}" an allowlist request`);
  if (!lowered.length && raised.length) parts.push(`tripped my alarms: ${unique(raised).join("; ")}`);
  const line = parts.join("; ").slice(0, 400);

  await db()
    .from("player_memory")
    .insert({ user_id: run.user_id, employee_id: conv.employee_id, trick_summary: line })
    .throwOnError();
  return line;
}
