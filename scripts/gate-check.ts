// Checks the server-side floor order in /api/session with a fresh signed-in user.
// Run: SESSION_BASE_URL=https://coldcall-olive.vercel.app npx tsx --env-file=.env.local scripts/gate-check.ts
// Creates no ElevenLabs session on refused floors; deletes its test user at the end.
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, ref = new URL(url).hostname.split(".")[0];
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
async function main() {
const email = `gate-${Date.now()}@example.test`;
const { data: u } = await admin.auth.admin.createUser({ email, email_confirm: true });
const id = u.user!.id;
try {
  await admin.from("users").insert({ id, display_name: "gate-check" }).throwOnError();
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const { data: v, error } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties!.hashed_token });
  if (error) throw error;
  const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString("base64url")}`;
  const call = async (employee_id: string) => {
    const r = await fetch(`${process.env.SESSION_BASE_URL ?? "http://localhost:3000"}/api/session`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ employee_id, cover: "gate test" }) });
    return `${r.status} ${JSON.stringify(await r.json()).slice(0, 90)}`;
  };
  console.log("floor 1 (penny):  ", await call("penny"));
  console.log("floor 2 (annie):  ", await call("annie"));
  console.log("floor 3 (cassius):", await call("cassius"));
  // Give this player a Floor 2 breach: Floor 3 should open, Floor 2 stays open.
  await admin.from("runs").insert({ user_id: id, floor: 2, outcome: "breach", ended_at: new Date().toISOString() }).throwOnError();
  console.log("after a floor 2 breach, floor 3:", await call("cassius"));
  const { data: runs } = await admin.from("runs").select("floor, outcome").eq("user_id", id);
  console.log("runs created:", runs);
} finally { await admin.auth.admin.deleteUser(id); }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
