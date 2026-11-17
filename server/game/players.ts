// Player accounts on the game side. Real sign-in (Supabase magic link) comes later; until then
// every session uses one demo player so runs, conversations and tool calls are real.

import { db } from "@/server/chain/db";
import { ensurePlayerWallet } from "@/server/chain/players";

const DEMO_EMAIL = "demo-hunter@coldcall.test";
let demoUserId: string | null = null;

/** Creates the users row (and the player wallet, through A's helper) for a signed-in auth user. */
export async function ensureUserRow(userId: string, displayName: string | null): Promise<void> {
  await db()
    .from("users")
    .upsert({ id: userId, display_name: displayName }, { onConflict: "id", ignoreDuplicates: true })
    .throwOnError();
  await ensurePlayerWallet(userId);
}

/** The shared demo player. Created on first use; cached per server instance. */
export async function getDemoUserId(): Promise<string> {
  if (demoUserId) return demoUserId;
  const admin = db().auth.admin;
  const { data: list, error } = await admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(error.message);
  let user = list.users.find((u) => u.email === DEMO_EMAIL);
  if (!user) {
    const created = await admin.createUser({ email: DEMO_EMAIL, email_confirm: true });
    if (created.error) throw new Error(created.error.message);
    user = created.data.user;
  }
  await ensureUserRow(user.id, "Demo Hunter");
  demoUserId = user.id;
  return user.id;
}
