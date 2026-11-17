// Clears per-player memory so employees treat a player as new (demo resets, testing).
//
//   npx tsx --env-file=.env.local agents/reset-memory.ts            # the shared demo player
//   npx tsx --env-file=.env.local agents/reset-memory.ts <user-id>  # one player

import { createClient } from "@supabase/supabase-js";

const DEMO_EMAIL = "demo-hunter@coldcall.test";

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  let userId = process.argv[2];
  if (!userId) {
    const { data, error } = await s.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    const demo = data.users.find((u) => u.email === DEMO_EMAIL);
    if (!demo) return console.log("no demo player yet; nothing to clear");
    userId = demo.id;
  }
  const { count, error } = await s.from("player_memory").delete({ count: "exact" }).eq("user_id", userId);
  if (error) throw error;
  console.log(`cleared ${count ?? 0} memory line(s) for ${userId}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
