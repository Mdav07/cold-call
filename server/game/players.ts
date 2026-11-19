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

/**
 * Makes sure a signed-in player has their users row and wallet before anything references them.
 * The email-link routes (/auth/confirm, /auth/callback) create them, but a password sign-up or sign-in
 * never passes through those, and without the row every new run fails its foreign key. Cheap when the
 * row and wallet already exist (one select).
 */
export async function ensureSignedInPlayer(userId: string): Promise<void> {
  const { data } = await db().from("users").select("wallet_address").eq("id", userId).maybeSingle();
  if (data?.wallet_address) return;
  const { data: auth } = await db().auth.admin.getUserById(userId);
  const handle = (auth?.user?.user_metadata as { handle?: string } | undefined)?.handle?.slice(0, 24) || null;
  await ensureUserRow(userId, handle);
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
