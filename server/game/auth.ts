// Supabase Auth on the server (magic link). Cookie-based session via @supabase/ssr.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Server client bound to the request cookies. Use in route handlers and server components. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a server component, where cookies are read-only; the next route
          // handler call refreshes them instead.
        }
      },
    },
  });
}

/** The signed-in player's auth id, or null. */
export async function signedInUserId(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const { data } = await (await supabaseServer()).auth.getUser();
  return data.user?.id ?? null;
}
