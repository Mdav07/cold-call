import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

let client: SupabaseClient | null = null;

/** Service-role client. Server only: it bypasses row level security. */
export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("missing Supabase env vars");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export class WalletBusy extends Error {
  constructor(wallet: string) {
    super(`wallet ${wallet} is busy`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs `fn` while holding the lease for one sending wallet, so two requests never
 * send from the same wallet at the same time. Throws WalletBusy after `waitMs`.
 */
export async function withWalletLease<T>(wallet: string, fn: () => Promise<T>, waitMs = 3000): Promise<T> {
  const key = wallet.toLowerCase();
  const holder = randomUUID();
  const deadline = Date.now() + waitMs;
  for (;;) {
    const { data, error } = await db().rpc("acquire_wallet_lock", { p_wallet: key, p_holder: holder });
    if (error) throw new Error(`lease: ${error.message}`);
    if (data === true) break;
    if (Date.now() >= deadline) throw new WalletBusy(key);
    await sleep(250);
  }
  try {
    return await fn();
  } finally {
    await db().rpc("release_wallet_lock", { p_wallet: key, p_holder: holder });
  }
}
