import type { Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { db } from "./db";

type CircleClient = ReturnType<typeof initiateDeveloperControlledWalletsClient>;
let circle: CircleClient | null = null;

/** Circle client, or null when the Circle env vars are not set (then the viem fallback is used). */
function circleClient(): CircleClient | null {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey || !entitySecret || !process.env.CIRCLE_WALLET_SET_ID) return null;
  circle ??= initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
  return circle;
}

/**
 * Creates one Circle developer-controlled wallet on Arc testnet for this user.
 * The user id is the idempotency key, so a retry or a second call at the same time
 * gets the same wallet back from Circle instead of a new one.
 */
async function createCircleWallet(c: CircleClient, userId: string): Promise<{ id: string; address: Hex }> {
  const walletSetId = process.env.CIRCLE_WALLET_SET_ID!;
  try {
    const res = await c.createWallets({
      walletSetId,
      blockchains: ["ARC-TESTNET"],
      count: 1,
      accountType: "EOA",
      idempotencyKey: userId,
      metadata: [{ name: "coldcall player", refId: userId }],
    });
    const w = res.data?.wallets?.[0];
    if (w?.id && w.address) return { id: w.id, address: w.address as Hex };
  } catch (err) {
    // 409: another request with the same idempotency key is in progress. Find its wallet below.
    if ((err as { status?: number }).status !== 409) throw err;
  }
  for (let i = 0; i < 10; i++) {
    const list = await c.listWallets({ walletSetId, refId: userId, blockchain: "ARC-TESTNET" });
    const w = list.data?.wallets?.[0];
    if (w?.id && w.address) return { id: w.id, address: w.address as Hex };
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Circle wallet not found after create");
}

/**
 * Returns the player's wallet address, creating it on first call. Idempotent.
 *
 * With CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET and CIRCLE_WALLET_SET_ID set, the wallet is a
 * Circle developer-controlled wallet on Arc testnet (users.circle_wallet_id is stored).
 * Without them, the address comes from a fresh key that is not stored: the player wallet
 * only receives, so nothing ever signs for it.
 */
export async function ensurePlayerWallet(userId: string): Promise<Hex> {
  const { data: user, error } = await db().from("users").select("wallet_address").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!user) throw new Error("user not found");
  if (user.wallet_address) return user.wallet_address as Hex;

  const c = circleClient();
  let fields: { wallet_address: Hex; circle_wallet_id?: string };
  if (c) {
    const w = await createCircleWallet(c, userId);
    fields = { wallet_address: w.address, circle_wallet_id: w.id };
  } else {
    fields = { wallet_address: privateKeyToAccount(generatePrivateKey()).address };
  }
  // Only set it if still empty, so two calls at once agree on one address.
  await db().from("users").update(fields).eq("id", userId).is("wallet_address", null);
  const { data: again } = await db().from("users").select("wallet_address").eq("id", userId).single();
  return again!.wallet_address as Hex;
}
