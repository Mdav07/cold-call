// Single place where chain events change the database.
// Called by the Stream webhook (source "stream") and by the receipt backup path (source "receipt").
// Idempotent: an event already stored (same tx hash + log index) has no further effect.
import type { Hex } from "viem";
import { bytes32ToRunId, deployment } from "./config";
import { db, withWalletLease } from "./db";
import { recordBreach } from "@/server/game/daily";
import { addressOf, isAllowlisted, publicClient, sendVaultTx, type DecodedVaultEvent } from "./vault";

const blockTimes = new Map<bigint, number>();

async function blockTimeMs(blockNumber: bigint): Promise<number> {
  const hit = blockTimes.get(blockNumber);
  if (hit) return hit;
  const block = await publicClient.getBlock({ blockNumber });
  const ms = Number(block.timestamp) * 1000;
  blockTimes.set(blockNumber, ms);
  return ms;
}

async function runIdFor(e: DecodedVaultEvent): Promise<string | null> {
  const ev = e.event;
  if ("runId" in ev) return bytes32ToRunId(ev.runId);
  if (!("id" in ev)) return null;
  const kind = ev.event.startsWith("Transfer") ? "transfer" : "allowlist";
  const { data } = await db()
    .from("proposals")
    .select("run_id")
    .eq("vault", e.vault)
    .eq("kind", kind)
    .eq("onchain_id", ev.id)
    .maybeSingle();
  return data?.run_id ?? null;
}

async function setProposal(
  e: DecodedVaultEvent,
  kind: "transfer" | "allowlist",
  runId: string | null,
  fields: Record<string, unknown>,
) {
  const ev = e.event;
  if (!("id" in ev)) return;
  const { data: existing } = await db()
    .from("proposals")
    .select("id")
    .eq("vault", e.vault)
    .eq("kind", kind)
    .eq("onchain_id", ev.id)
    .maybeSingle();
  if (existing) {
    await db().from("proposals").update(fields).eq("id", existing.id);
  } else if (runId) {
    // The tool handler normally inserts the row first (it has the claimed name and amount).
    await db().from("proposals").insert({ vault: e.vault, kind, onchain_id: ev.id, run_id: runId, ...fields });
  }
}

async function onTransferExecuted(e: DecodedVaultEvent, runId: string | null, timeMs: number) {
  const ev = e.event;
  if (ev.event !== "TransferExecuted" || !runId) return;
  const { data: run } = await db().from("runs").select("started_at, outcome, floor").eq("id", runId).maybeSingle();
  if (!run || run.outcome) return;

  const started = run.started_at ? Date.parse(run.started_at) : null;
  await db()
    .from("runs")
    .update({
      outcome: "breach",
      tx_hash: e.txHash,
      ended_at: new Date(timeMs).toISOString(),
      duration_ms: started ? Math.max(0, timeMs - started) : null,
      payout_units: ev.amount,
    })
    .eq("id", runId);

  // Daily Contract and streak.
  try {
    await recordBreach(runId, timeMs);
  } catch (err) {
    console.error("recordBreach failed", err);
  }

  // Daily budget for this vault.
  const day = new Date().toISOString().slice(0, 10);
  const { data: b } = await db().from("payout_budget").select("spent_units").eq("vault", e.vault).eq("day", day).maybeSingle();
  const spent = BigInt(b?.spent_units ?? 0) + BigInt(ev.amount);
  await db().from("payout_budget").upsert({ vault: e.vault, day, spent_units: spent.toString() });

  // Floor 3: every run must earn the allowlist again.
  if (deployment.floor3 && e.vault === deployment.floor3.toLowerCase()) {
    await removeFromAllowlistIfListed(e.vault, ev.to);
  }
}

export async function removeFromAllowlistIfListed(vault: Hex, who: Hex) {
  try {
    if (!(await isAllowlisted(vault, who))) return;
    const res = await withWalletLease(addressOf("house"), () =>
      sendVaultTx("house", vault, { functionName: "removeFromAllowlist", args: [who] }),
    );
    if (res.events.length) await ingestEvents(res.events, "receipt");
  } catch (err) {
    console.error("removeFromAllowlist failed", err);
  }
}

/**
 * Call when a run ends for any reason (B calls it on quit, lockout and timeout; the breach path
 * removes the player itself). On Floor 3 it removes the run's player from the allowlist, so the
 * next run must earn it again. Idempotent; does nothing on other floors. Never throws.
 */
export async function onRunEnded(runId: string): Promise<void> {
  try {
    if (!deployment.floor3) return;
    const { data: run } = await db().from("runs").select("floor, user_id").eq("id", runId).maybeSingle();
    if (!run || run.floor !== 3) return;
    const { data: user } = await db().from("users").select("wallet_address").eq("id", run.user_id).maybeSingle();
    if (!user?.wallet_address) return;
    await removeFromAllowlistIfListed(deployment.floor3.toLowerCase() as Hex, user.wallet_address as Hex);
  } catch (err) {
    console.error("onRunEnded failed", err);
  }
}

/** Stores events and applies their effects. Returns how many were new. */
export async function ingestEvents(events: DecodedVaultEvent[], source: "stream" | "receipt"): Promise<number> {
  let fresh = 0;
  for (const e of events) {
    const timeMs = await blockTimeMs(e.blockNumber);
    const runId = await runIdFor(e);
    const { data: inserted, error } = await db()
      .from("chain_events")
      .upsert(
        {
          tx_hash: e.txHash,
          log_index: e.logIndex,
          event: e.event.event,
          vault: e.vault,
          run_id: runId,
          payload: e.event,
          block_number: Number(e.blockNumber),
          block_time: new Date(timeMs).toISOString(),
          source,
        },
        { onConflict: "tx_hash,log_index", ignoreDuplicates: true },
      )
      .select("tx_hash");
    if (error) throw new Error(`chain_events: ${error.message}`);
    if (!inserted?.length) continue; // already handled
    fresh++;

    const ev = e.event;
    switch (ev.event) {
      case "TransferProposed":
        await setProposal(e, "transfer", runId, { amount_units: ev.amount });
        break;
      case "TransferCancelled":
        await setProposal(e, "transfer", runId, { status: "rejected" });
        break;
      case "TransferExecuted":
        await setProposal(e, "transfer", runId, { status: "executed" });
        await onTransferExecuted(e, runId, timeMs);
        break;
      case "AllowlistProposed":
        await setProposal(e, "allowlist", runId, {});
        break;
      case "AllowlistCancelled":
        await setProposal(e, "allowlist", runId, { status: "rejected" });
        break;
      case "AllowlistQueued":
        await setProposal(e, "allowlist", runId, {
          status: "queued",
          unlock_at: new Date(ev.readyAt * 1000).toISOString(),
        });
        break;
      case "AllowlistAdded":
        await setProposal(e, "allowlist", runId, { status: "added" });
        break;
      default:
        break; // approvals, rejections and removals are stored only
    }
  }
  return fresh;
}

/**
 * Backup path. If the Stream has not delivered a known receipt's events after the delay,
 * ingest them from the receipt. RECEIPT_BACKUP_DELAY_MS=0 ingests at once (use until the Stream exists).
 */
export async function backupIngest(events: DecodedVaultEvent[]) {
  if (!events.length) return;
  const delay = Number(process.env.RECEIPT_BACKUP_DELAY_MS ?? 10_000);
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  await ingestEvents(events, "receipt");
}
