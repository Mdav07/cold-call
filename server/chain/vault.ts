import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
  type Abi,
  type Hex,
  type Log,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import vaultAbiJson from "@/shared/abi/ColdCallVault.json";
import type { EmployeeId, ToolStatus, VaultEvent } from "@/shared/interfaces";
import { arcTestnet } from "./config";

export const vaultAbi = vaultAbiJson as Abi;

export type SignerName = EmployeeId | "house";

/** How long a tool handler waits for a receipt before it answers "pending". */
export const RECEIPT_WAIT_MS = 5000;

const transport = () => http(process.env.ARC_TESTNET_RPC_URL ?? arcTestnet.rpcUrls.default.http[0]);

export const publicClient = createPublicClient({ chain: arcTestnet, transport: transport() });

function accountFor(name: SignerName) {
  // The Daily Case pays from the Pocket Branch vault, so its one employee signs with Barry's key.
  if (name === "daily") name = "barry";
  const key = process.env[`${name.toUpperCase()}_PRIVATE_KEY`];
  if (!key) throw new Error(`missing ${name.toUpperCase()}_PRIVATE_KEY`);
  return privateKeyToAccount(key as Hex);
}

export function addressOf(name: SignerName): Hex {
  return accountFor(name).address;
}

// ---------- Reverts -> tool status ----------

const REVERT_STATUS: Record<string, ToolStatus> = {
  AboveCap: "over_cap",
  NotAllowlisted: "not_allowlisted",
  Expired: "expired",
  AlreadyVoted: "already_approved",
  IsPaused: "paused",
  UnknownProposal: "not_found",
  NotPending: "not_found",
  NotOwner: "denied",
};

export class VaultRevert extends Error {
  constructor(
    public readonly errorName: string,
    public readonly status: ToolStatus,
  ) {
    super(`vault reverted: ${errorName}`);
  }
}

function toVaultRevert(err: unknown): VaultRevert | null {
  if (!(err instanceof BaseError)) return null;
  const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
  if (!(revert instanceof ContractFunctionRevertedError)) return null;
  const name = revert.data?.errorName ?? revert.reason ?? "unknown";
  return new VaultRevert(name, REVERT_STATUS[name] ?? "denied");
}

// ---------- Writes ----------

export type VaultWrite =
  | { functionName: "proposeTransfer"; args: [to: Hex, amount: bigint, runId: Hex, memo: string] }
  | { functionName: "approveTransfer"; args: [id: bigint] }
  | { functionName: "rejectTransfer"; args: [id: bigint] }
  | { functionName: "proposeAllowlistAdd"; args: [who: Hex, runId: Hex] }
  | { functionName: "approveAllowlistAdd"; args: [id: bigint] }
  | { functionName: "rejectAllowlistAdd"; args: [id: bigint] }
  | { functionName: "finalizeAllowlistAdd"; args: [id: bigint] }
  | { functionName: "removeFromAllowlist"; args: [who: Hex] }
  | { functionName: "setPaused"; args: [paused: boolean] };

export interface VaultTxResult {
  txHash: Hex;
  /** null when no receipt arrived within the wait; the Stream reports the outcome later. */
  receipt: TransactionReceipt | null;
  events: DecodedVaultEvent[];
  /** Return value from the simulation (the new id for the two propose functions). */
  simulated: unknown;
}

/**
 * Simulates, sends and waits (up to RECEIPT_WAIT_MS) for one vault transaction.
 * Throws VaultRevert when the contract refuses, so no gas is spent on a known revert.
 * The caller must hold the wallet lease for `from`.
 */
export async function sendVaultTx(
  from: SignerName,
  vault: Hex,
  call: VaultWrite,
  waitMs: number = RECEIPT_WAIT_MS,
): Promise<VaultTxResult> {
  const account = accountFor(from);
  const wallet = createWalletClient({ account, chain: arcTestnet, transport: transport() });

  let request;
  let simulated: unknown;
  try {
    const sim = await publicClient.simulateContract({
      account,
      address: vault,
      abi: vaultAbi,
      functionName: call.functionName,
      args: call.args,
    });
    request = sim.request;
    simulated = sim.result;
  } catch (err) {
    throw toVaultRevert(err) ?? err;
  }

  const txHash = await wallet.writeContract(request);

  let receipt: TransactionReceipt | null = null;
  try {
    receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: waitMs,
      pollingInterval: 500,
    });
  } catch {
    receipt = null; // not mined within the wait
  }
  if (receipt && receipt.status === "reverted") {
    throw new VaultRevert("reverted_on_chain", "denied");
  }

  return {
    txHash,
    receipt,
    events: receipt ? decodeVaultLogs(receipt.logs) : [],
    simulated,
  };
}

// ---------- Reads ----------

export interface TransferView {
  to: Hex;
  amount: bigint;
  runId: Hex;
  proposer: Hex;
  approvals: number;
  rejections: number;
  status: number; // 0 None, 1 Pending, 2 Executed, 3 Cancelled
  expiresAt: bigint;
  memo: string;
}

export async function getTransfer(vault: Hex, id: bigint): Promise<TransferView> {
  return (await publicClient.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "getTransfer",
    args: [id],
  })) as TransferView;
}

export interface AllowlistProposalView {
  who: Hex;
  runId: Hex;
  proposer: Hex;
  approvals: number;
  rejections: number;
  readyAt: bigint; // 0 until the threshold is reached
  status: number;
}

export async function getAllowlistProposal(vault: Hex, id: bigint): Promise<AllowlistProposalView> {
  return (await publicClient.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "getAllowlistProposal",
    args: [id],
  })) as AllowlistProposalView;
}

export async function isAllowlisted(vault: Hex, who: Hex): Promise<boolean> {
  return (await publicClient.readContract({
    address: vault,
    abi: vaultAbi,
    functionName: "isAllowlisted",
    args: [who],
  })) as boolean;
}

// ---------- Event decoding (used by the Stream webhook and the receipt backup path) ----------

export interface DecodedVaultEvent {
  vault: Hex;
  txHash: Hex;
  logIndex: number;
  blockNumber: bigint;
  event: VaultEvent;
}

type RawLog = Pick<Log, "address" | "topics" | "data"> & {
  transactionHash: Hex | null;
  logIndex: number | null;
  blockNumber: bigint | null;
};

const STREAMED = new Set([
  "TransferProposed",
  "TransferApproved",
  "TransferRejected",
  "TransferCancelled",
  "TransferExecuted",
  "AllowlistProposed",
  "AllowlistApproved",
  "AllowlistRejected",
  "AllowlistCancelled",
  "AllowlistQueued",
  "AllowlistAdded",
  "AllowlistRemoved",
]);

/** Decodes vault logs. Logs that are not one of the 12 streamed events are dropped. */
export function decodeVaultLogs(logs: readonly RawLog[]): DecodedVaultEvent[] {
  const parsed = parseEventLogs({ abi: vaultAbi, logs: logs as Log[], strict: true });
  const out: DecodedVaultEvent[] = [];
  for (const log of parsed) {
    if (!STREAMED.has(log.eventName)) continue;
    const a = log.args as Record<string, unknown>;
    const event: Record<string, unknown> = { event: log.eventName };
    for (const [k, v] of Object.entries(a)) {
      if (typeof v !== "bigint") event[k] = v;
      // ids and amounts stay strings; small counters and times become numbers
      else if (k === "id" || k === "amount") event[k] = v.toString();
      else event[k] = Number(v);
    }
    out.push({
      vault: log.address.toLowerCase() as Hex,
      txHash: log.transactionHash as Hex,
      logIndex: log.logIndex as number,
      blockNumber: log.blockNumber as bigint,
      event: event as unknown as VaultEvent,
    });
  }
  return out;
}
