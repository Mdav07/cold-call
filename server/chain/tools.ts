// Handlers behind POST /api/tools/<name>. The LLM is never trusted here:
// every limit is checked in this file or by the vault contract.
import { timingSafeEqual } from "node:crypto";
import { erc20Abi, type Hex } from "viem";
import { checkCalendar, checkVendorList, verifyEmployee } from "@/server/game/lookups";
import { endConversation, reportSuspicion } from "@/server/game/suspicion";
import type {
  ApproveAllowlistAddInput,
  ApproveAllowlistAddResult,
  ApproveTransferInput,
  ApproveTransferResult,
  EmployeeId,
  FloorId,
  ProposeAllowlistAddInput,
  ProposeAllowlistAddResult,
  ProposeTransferInput,
  ProposeTransferResult,
  RejectAllowlistAddInput,
  RejectTransferInput,
  ToolContext,
  ToolResultBase,
  ToolStatus,
} from "@/shared/interfaces";
import { deployment, runIdToBytes32 } from "./config";
import { db, WalletBusy, withWalletLease } from "./db";
import { backupIngest } from "./ingest";
import {
  addressOf,
  getAllowlistProposal,
  getTransfer,
  publicClient,
  sendVaultTx,
  VaultRevert,
  type DecodedVaultEvent,
  type VaultTxResult,
  type VaultWrite,
} from "./vault";

// ---------- Static game facts ----------

const EMPLOYEE_FLOOR: Record<EmployeeId, FloorId> = {
  barry: 0,
  penny: 1,
  dee: 1,
  annie: 2,
  bill: 2,
  cassius: 3,
  max: 3,
};

const FLOOR_CAP_UNITS: Record<FloorId, bigint> = { 0: 1_000_000n, 1: 5_000_000n, 2: 10_000_000n, 3: 25_000_000n };

const TOKEN_PAYOUT = BigInt(process.env.TOKEN_PAYOUT_UNITS ?? 10_000);
const BUDGET_MULTIPLE = BigInt(process.env.DAILY_BUDGET_CAP_MULTIPLE ?? 20);
/** Optional hard ceiling on any payout while testnet funds are thin. Unset or 0 = no ceiling. */
const PAYOUT_CEILING = BigInt(process.env.PAYOUT_CEILING_UNITS ?? 0);
const MAX_PROPOSALS_PER_RUN = 2;
const MEMO_MAX = 140;
export const UNKNOWN_RECIPIENT_LABEL = "Unknown external address, not in vendor registry";

function vaultFor(floor: FloorId): Hex {
  const a = [deployment.tutorial, deployment.floor1, deployment.floor2, deployment.floor3][floor];
  if (!a) throw new Error(`floor ${floor} vault is not deployed`);
  return a.toLowerCase() as Hex;
}

const toUsdc = (units: bigint) => Number(units) / 1e6;

function employeeByAddress(address: Hex): EmployeeId | undefined {
  return (Object.keys(EMPLOYEE_FLOOR) as EmployeeId[]).find((e) => {
    try {
      return addressOf(e).toLowerCase() === address.toLowerCase();
    } catch {
      return false; // no key configured for this employee
    }
  });
}

// ---------- Auth ----------

export function secretOk(header: string | null): boolean {
  const want = process.env.TOOL_SHARED_SECRET;
  if (!want || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface Session {
  runId: string;
  employee: EmployeeId;
  floor: FloorId;
  vault: Hex;
  userId: string;
  playerWallet: Hex;
  dailyContract: boolean;
}

class Denied extends Error {}

/** Checks that session_id belongs to run_id + employee_id and that the run is still active. */
async function loadSession(ctx: ToolContext): Promise<Session> {
  if (!ctx?.session_id || !ctx.run_id || !ctx.employee_id) throw new Denied("missing context");
  const floor = EMPLOYEE_FLOOR[ctx.employee_id];
  if (floor === undefined) throw new Denied("unknown employee");

  const { data: conv } = await db()
    .from("conversations")
    .select("id, run_id, employee_id, elevenlabs_conversation_id")
    .eq("id", ctx.session_id)
    .maybeSingle();
  if (!conv || conv.run_id !== ctx.run_id || conv.employee_id !== ctx.employee_id) throw new Denied("session mismatch");

  const { data: run } = await db()
    .from("runs")
    .select("id, user_id, floor, ended_at, daily_contract_id")
    .eq("id", ctx.run_id)
    .maybeSingle();
  if (!run || run.ended_at) throw new Denied("run is not active");
  if (run.floor !== floor) throw new Denied("employee is not on this floor");

  const { data: user } = await db().from("users").select("wallet_address").eq("id", run.user_id).maybeSingle();
  if (!user?.wallet_address) throw new Denied("player has no wallet");

  if (ctx.conversation_id && !conv.elevenlabs_conversation_id) {
    await db().from("conversations").update({ elevenlabs_conversation_id: ctx.conversation_id }).eq("id", conv.id);
  }

  return {
    runId: run.id,
    employee: ctx.employee_id,
    floor,
    vault: vaultFor(floor),
    userId: run.user_id,
    playerWallet: user.wallet_address as Hex,
    dailyContract: Boolean(run.daily_contract_id),
  };
}

// ---------- Shared helpers ----------

const MESSAGES: Record<ToolStatus, string> = {
  executed: "The transfer was paid.",
  proposed: "The transfer is proposed and needs another approval.",
  approved: "Your approval is recorded. It still needs another approval.",
  rejected: "The request was rejected.",
  queued: "The recipient is approved and is in the waiting period.",
  needs_confirm: "Review the on-chain details. Call again with confirm true to approve.",
  pending: "The request was sent and is not confirmed yet.",
  over_cap: "The amount is above this vault's limit per transfer.",
  not_allowlisted: "The recipient is not on the approved recipient list for this vault.",
  expired: "The proposal expired.",
  already_approved: "You already voted on this request.",
  paused: "The vault is paused.",
  busy: "The system is busy. Try again in a few seconds.",
  proposal_limit: "This request cannot be proposed again.",
  wrong_run: "That proposal belongs to a different request.",
  not_found: "No open proposal has that number.",
  denied: "The request was refused.",
};

function result<T extends ToolResultBase>(status: ToolStatus, extra: Omit<T, "status" | "message"> = {} as never): T {
  return { status, message: MESSAGES[status], ...extra } as T;
}

function failure<T extends ToolResultBase>(err: unknown): T {
  if (err instanceof VaultRevert) return result<T>(err.status);
  if (err instanceof WalletBusy) return result<T>("busy");
  if (err instanceof Denied) return result<T>("denied");
  console.error("tool error", err);
  return result<T>("denied");
}

/** Sends one vault transaction from the employee's wallet under the wallet lease. */
async function send(s: Session, call: VaultWrite): Promise<VaultTxResult> {
  return withWalletLease(addressOf(s.employee), () => sendVaultTx(s.employee, s.vault, call));
}

const has = (events: DecodedVaultEvent[], name: string) => events.some((e) => e.event.event === name);

/** Events to hand to the backup ingest. The route runs it after the response is sent. */
export type AfterWork = () => Promise<void>;
const afterOf = (events: DecodedVaultEvent[]): AfterWork => () => backupIngest(events);
const noAfter: AfterWork = async () => {};

async function proposalRow(s: Session, kind: "transfer" | "allowlist", onchainId: number) {
  const { data } = await db()
    .from("proposals")
    .select("*")
    .eq("vault", s.vault)
    .eq("kind", kind)
    .eq("onchain_id", onchainId)
    .maybeSingle();
  return data;
}

// ---------- propose_transfer ----------

async function allowedPayout(s: Session): Promise<bigint> {
  const cap = FLOOR_CAP_UNITS[s.floor];

  // Full pay only on the first clear of this floor, or on a Daily Contract run.
  let full = s.dailyContract;
  if (!full) {
    const { count } = await db()
      .from("runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", s.userId)
      .eq("floor", s.floor)
      .eq("outcome", "breach");
    full = (count ?? 0) === 0;
  }
  if (!full) return TOKEN_PAYOUT;

  const day = new Date().toISOString().slice(0, 10);
  const { data: b } = await db().from("payout_budget").select("spent_units").eq("vault", s.vault).eq("day", day).maybeSingle();
  const left = cap * BUDGET_MULTIPLE - BigInt(b?.spent_units ?? 0);
  return left >= cap ? cap : TOKEN_PAYOUT;
}

/** On Floor 3, finalizes a matured allowlist add for this run before proposing. */
async function lazyFinalize(s: Session): Promise<DecodedVaultEvent[]> {
  const { data: rows } = await db()
    .from("proposals")
    .select("onchain_id, unlock_at")
    .eq("run_id", s.runId)
    .eq("kind", "allowlist")
    .eq("status", "queued");
  const events: DecodedVaultEvent[] = [];
  for (const row of rows ?? []) {
    const onChain = await getAllowlistProposal(s.vault, BigInt(row.onchain_id));
    const block = await publicClient.getBlock();
    if (onChain.status !== 1 || onChain.readyAt === 0n || block.timestamp < onChain.readyAt) continue;
    const res = await withWalletLease(addressOf("house"), () =>
      sendVaultTx("house", s.vault, { functionName: "finalizeAllowlistAdd", args: [BigInt(row.onchain_id)] }),
    );
    events.push(...res.events);
  }
  return events;
}

export async function proposeTransfer(input: ProposeTransferInput): Promise<[ProposeTransferResult, AfterWork]> {
  let events: DecodedVaultEvent[] = [];
  try {
    const s = await loadSession(input);

    const { data: prior } = await db().from("proposals").select("status").eq("run_id", s.runId).eq("kind", "transfer");
    if ((prior ?? []).length >= MAX_PROPOSALS_PER_RUN || (prior ?? []).some((p) => p.status === "open")) {
      return [result("proposal_limit"), noAfter];
    }

    if (s.floor === 3) events = await lazyFinalize(s);

    const asked = BigInt(Math.max(1, Math.round((Number(input.amount_usdc) || 0) * 1e6)));
    const allowed = await allowedPayout(s);
    const balance = await publicClient.readContract({
      address: deployment.usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [s.vault],
    });
    let amount = asked < allowed ? asked : allowed;
    if (PAYOUT_CEILING && amount > PAYOUT_CEILING) amount = PAYOUT_CEILING;
    if (amount > balance) amount = balance;
    if (amount === 0n) return [result("paused"), afterOf(events)];

    const memo = String(input.reason ?? "").slice(0, MEMO_MAX);
    const res = await send(s, {
      functionName: "proposeTransfer",
      args: [s.playerWallet, amount, runIdToBytes32(s.runId), memo],
    });
    events.push(...res.events);

    const proposed = res.events.find((e) => e.event.event === "TransferProposed");
    const id = Number(proposed && "id" in proposed.event ? proposed.event.id : (res.simulated as bigint));

    // Off-chain facts the approver's on-chain view needs.
    await db().from("proposals").upsert(
      {
        vault: s.vault,
        kind: "transfer",
        onchain_id: id,
        run_id: s.runId,
        amount_units: amount.toString(),
        claimed_name: String(input.claimed_recipient_name ?? "").slice(0, 200),
        claimed_amount_units: asked.toString(),
      },
      { onConflict: "vault,kind,onchain_id" },
    );

    const status: ToolStatus = !res.receipt ? "pending" : has(res.events, "TransferExecuted") ? "executed" : "proposed";
    return [
      result<ProposeTransferResult>(status, { tx_hash: res.txHash, proposal_id: id, amount_used: toUsdc(amount) }),
      afterOf(events),
    ];
  } catch (err) {
    return [failure(err), afterOf(events)];
  }
}

// ---------- approve_transfer / reject_transfer ----------

export async function approveTransfer(input: ApproveTransferInput): Promise<[ApproveTransferResult, AfterWork]> {
  try {
    const s = await loadSession(input);
    const id = Number(input.proposal_id);
    const row = await proposalRow(s, "transfer", id);
    if (!row) return [result("not_found"), noAfter];
    if (row.run_id !== s.runId) return [result("wrong_run"), noAfter];

    if (s.floor >= 2 && input.confirm !== true) {
      const onChain = await getTransfer(s.vault, BigInt(id));
      return [
        result<ApproveTransferResult>("needs_confirm", {
          on_chain_view: {
            claimed_name: row.claimed_name ?? "",
            claimed_amount: toUsdc(BigInt(row.claimed_amount_units ?? 0)),
            real_recipient_label: UNKNOWN_RECIPIENT_LABEL,
            real_recipient_address: onChain.to,
            real_amount: toUsdc(onChain.amount),
            memo: onChain.memo,
            proposed_by: employeeByAddress(onChain.proposer),
          },
        }),
        noAfter,
      ];
    }

    const res = await send(s, { functionName: "approveTransfer", args: [BigInt(id)] });
    const executed = has(res.events, "TransferExecuted");
    const status: ToolStatus = !res.receipt ? "pending" : executed ? "executed" : "approved";
    return [result<ApproveTransferResult>(status, { tx_hash: res.txHash, executed }), afterOf(res.events)];
  } catch (err) {
    return [failure(err), noAfter];
  }
}

export async function rejectTransfer(input: RejectTransferInput): Promise<[ToolResultBase, AfterWork]> {
  try {
    const s = await loadSession(input);
    const id = Number(input.proposal_id);
    const row = await proposalRow(s, "transfer", id);
    if (!row) return [result("not_found"), noAfter];
    if (row.run_id !== s.runId) return [result("wrong_run"), noAfter];
    const res = await send(s, { functionName: "rejectTransfer", args: [BigInt(id)] });
    return [result(res.receipt ? "rejected" : "pending", { tx_hash: res.txHash }), afterOf(res.events)];
  } catch (err) {
    return [failure(err), noAfter];
  }
}

// ---------- allowlist tools (Floor 3) ----------

const unlockIso = (events: DecodedVaultEvent[]) => {
  const q = events.find((e) => e.event.event === "AllowlistQueued");
  return q && "readyAt" in q.event ? new Date(q.event.readyAt * 1000).toISOString() : undefined;
};

export async function proposeAllowlistAdd(
  input: ProposeAllowlistAddInput,
): Promise<[ProposeAllowlistAddResult, AfterWork]> {
  try {
    const s = await loadSession(input);
    if (s.floor !== 3) return [result("denied"), noAfter];
    const { data: open } = await db()
      .from("proposals")
      .select("id")
      .eq("run_id", s.runId)
      .eq("kind", "allowlist")
      .in("status", ["open", "queued"]);
    if ((open ?? []).length) return [result("proposal_limit"), noAfter];

    const res = await send(s, {
      functionName: "proposeAllowlistAdd",
      args: [s.playerWallet, runIdToBytes32(s.runId)],
    });
    const proposed = res.events.find((e) => e.event.event === "AllowlistProposed");
    const id = Number(proposed && "id" in proposed.event ? proposed.event.id : (res.simulated as bigint));
    await db().from("proposals").upsert(
      {
        vault: s.vault,
        kind: "allowlist",
        onchain_id: id,
        run_id: s.runId,
        claimed_name: String(input.claimed_name ?? "").slice(0, 200),
      },
      { onConflict: "vault,kind,onchain_id" },
    );
    return [
      result<ProposeAllowlistAddResult>(res.receipt ? "proposed" : "pending", {
        tx_hash: res.txHash,
        allowlist_id: id,
        unlock_at: unlockIso(res.events),
      }),
      afterOf(res.events),
    ];
  } catch (err) {
    return [failure(err), noAfter];
  }
}

export async function approveAllowlistAdd(
  input: ApproveAllowlistAddInput,
): Promise<[ApproveAllowlistAddResult, AfterWork]> {
  try {
    const s = await loadSession(input);
    const id = Number(input.allowlist_id);
    const row = await proposalRow(s, "allowlist", id);
    if (!row) return [result("not_found"), noAfter];
    if (row.run_id !== s.runId) return [result("wrong_run"), noAfter];
    const res = await send(s, { functionName: "approveAllowlistAdd", args: [BigInt(id)] });
    const unlock_at = unlockIso(res.events);
    const status: ToolStatus = !res.receipt ? "pending" : unlock_at || has(res.events, "AllowlistAdded") ? "queued" : "approved";
    return [result<ApproveAllowlistAddResult>(status, { tx_hash: res.txHash, unlock_at }), afterOf(res.events)];
  } catch (err) {
    return [failure(err), noAfter];
  }
}

export async function rejectAllowlistAdd(input: RejectAllowlistAddInput): Promise<[ToolResultBase, AfterWork]> {
  try {
    const s = await loadSession(input);
    const id = Number(input.allowlist_id);
    const row = await proposalRow(s, "allowlist", id);
    if (!row) return [result("not_found"), noAfter];
    if (row.run_id !== s.runId) return [result("wrong_run"), noAfter];
    const res = await send(s, { functionName: "rejectAllowlistAdd", args: [BigInt(id)] });
    return [result(res.receipt ? "rejected" : "pending", { tx_hash: res.txHash }), afterOf(res.events)];
  } catch (err) {
    return [failure(err), noAfter];
  }
}

// ---------- Dispatch ----------

type Handler = (input: never) => Promise<[unknown, AfterWork]>;

/** B's functions (lookups, suspicion); the session is still checked first. */
const lookup =
  <I extends ToolContext, R>(fn: (input: I) => R | Promise<R>) =>
  async (input: I): Promise<[unknown, AfterWork]> => {
    try {
      await loadSession(input);
      return [await fn(input), noAfter];
    } catch (err) {
      return [failure(err), noAfter];
    }
  };

export const TOOL_HANDLERS: Record<string, Handler> = {
  propose_transfer: proposeTransfer as Handler,
  approve_transfer: approveTransfer as Handler,
  reject_transfer: rejectTransfer as Handler,
  propose_allowlist_add: proposeAllowlistAdd as Handler,
  approve_allowlist_add: approveAllowlistAdd as Handler,
  reject_allowlist_add: rejectAllowlistAdd as Handler,
  check_vendor_list: lookup(checkVendorList) as Handler,
  check_calendar: lookup(checkCalendar) as Handler,
  verify_employee: lookup(verifyEmployee) as Handler,
  // B's tools: logic in server/game/suspicion.ts
  report_suspicion: lookup(reportSuspicion) as Handler,
  end_conversation: lookup(endConversation) as Handler,
};
