import type { Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { db } from "./db";

/**
 * Returns the player's wallet address, creating it on first call. Idempotent.
 *
 * SIGNER_MODE=viem (current): the address comes from a fresh key that is not stored.
 * The player wallet only receives, so nothing ever needs to sign for it; the testnet
 * funds in it cannot be moved. The Circle developer-controlled wallet replaces this.
 */
export async function ensurePlayerWallet(userId: string): Promise<Hex> {
  const { data: user, error } = await db().from("users").select("wallet_address").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!user) throw new Error("user not found");
  if (user.wallet_address) return user.wallet_address as Hex;

  const address = privateKeyToAccount(generatePrivateKey()).address;
  // Only set it if still empty, so two calls at once agree on one address.
  await db().from("users").update({ wallet_address: address }).eq("id", userId).is("wallet_address", null);
  const { data: again } = await db().from("users").select("wallet_address").eq("id", userId).single();
  return again!.wallet_address as Hex;
}
