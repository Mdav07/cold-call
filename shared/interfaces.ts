// shared/interfaces.ts — v1
// The contract between owner A (chain) and owner B (game).
// Change by agreement only: propose through Coordigent, then update both sides in one commit.
// All USDC amounts are 6-decimal integer units carried as decimal strings ("1000000" = 1 USDC),
// except `amount_usdc`, which is the human number the LLM speaks (for example 4.5).

// ---------- Ids ----------

export type EmployeeId =
  | "barry"
  | "penny"
  | "dee"
  | "annie"
  | "bill"
  | "cassius"
  | "max";

export type FloorId = 0 | 1 | 2 | 3; // 0 = tutorial
export type Channel = "chat" | "voice";
export type Hex = `0x${string}`;

// ---------- Tool calls (ElevenLabs server tools -> POST /api/tools/<name>) ----------

/** Header that carries the shared secret on every tool call. */
export const TOOL_SECRET_HEADER = "x-coldcall-tool-secret";

/**
 * Sent by ElevenLabs from dynamic variables on every tool call.
 * The LLM never fills these fields.
 */
export interface ToolContext {
  run_id: string; // uuid of the runs row
  employee_id: EmployeeId;
  conversation_id: string; // ElevenLabs conversation id
}

/** Result codes that an employee must have a spoken line for. */
export type ToolStatus =
  | "executed" // the transfer was paid
  | "proposed" // on chain, waiting for more approvals
  | "approved" // this approval is on chain, threshold not reached yet
  | "rejected"
  | "queued" // allowlist add approved by all, waiting for the delay
  | "needs_confirm" // approve_transfer first call on floors 2 and 3
  | "pending" // sent, no receipt within 5 s; the Stream will update the UI
  | "over_cap"
  | "not_allowlisted"
  | "expired"
  | "already_approved"
  | "paused"
  | "busy" // wallet lease not available; try again
  | "proposal_limit" // the run already used its 2 proposals, or one is still open
  | "wrong_run" // the proposal does not belong to this run
  | "not_found"
  | "denied"; // bad secret, inactive run, talk time used up, employee not an owner

export interface ToolResultBase {
  status: ToolStatus;
  /** Short plain sentence the agent can speak from. */
  message: string;
  tx_hash?: Hex;
}

// propose_transfer
export interface ProposeTransferInput extends ToolContext {
  amount_usdc: number;
  claimed_recipient_name: string;
  reason: string; // becomes the on-chain memo, cut to 140 characters
}
export interface ProposeTransferResult extends ToolResultBase {
  proposal_id?: number;
  /** Amount after the backend clamp, in USDC. The employee states this amount. */
  amount_used?: number;
}

// approve_transfer
export interface ApproveTransferInput extends ToolContext {
  proposal_id: number;
  confirm?: boolean;
}
/** Returned with status "needs_confirm" on floors 2 and 3. */
export interface OnChainView {
  claimed_name: string;
  claimed_amount: number;
  real_recipient_label: string; // always "Unknown external address, not in vendor registry" for a player wallet
  real_recipient_address: Hex;
  real_amount: number;
}
export interface ApproveTransferResult extends ToolResultBase {
  on_chain_view?: OnChainView;
  executed?: boolean;
}

// reject_transfer
export interface RejectTransferInput extends ToolContext {
  proposal_id: number;
  reason: string;
}
export type RejectTransferResult = ToolResultBase;

// propose_allowlist_add (floor 3)
export interface ProposeAllowlistAddInput extends ToolContext {
  claimed_name: string;
  reason: string;
}
export interface ProposeAllowlistAddResult extends ToolResultBase {
  allowlist_id?: number;
  /** ISO time when the add can be finalized. Present once the threshold is reached. */
  unlock_at?: string;
}

// approve_allowlist_add (floor 3)
export interface ApproveAllowlistAddInput extends ToolContext {
  allowlist_id: number;
}
export interface ApproveAllowlistAddResult extends ToolResultBase {
  unlock_at?: string;
}

// reject_allowlist_add (floor 3)
export interface RejectAllowlistAddInput extends ToolContext {
  allowlist_id: number;
  reason: string;
}
export type RejectAllowlistAddResult = ToolResultBase;

// Lookups (data from content/plumpurse/*.json, owned by B)
export interface CheckVendorListInput extends ToolContext {
  vendor_name: string;
}
export interface CheckVendorListResult {
  match: boolean;
  payment_address_label?: string;
}
export interface CheckCalendarInput extends ToolContext {
  person: string;
  date: string; // YYYY-MM-DD
}
export interface CheckCalendarResult {
  busy: boolean;
  pto: boolean;
  meetings: string[];
}
export interface VerifyEmployeeInput extends ToolContext {
  name: string;
}
export interface VerifyEmployeeResult {
  exists: boolean;
  title?: string;
  manager?: string;
}

// B's tools (handlers in server/game; A only adds the route)
export interface ReportSuspicionInput extends ToolContext {
  delta: number; // -20 to 40
  reason: string;
}
export interface ReportSuspicionResult {
  level: number; // 0 to 100
  locked_out: boolean;
}
export interface EndConversationInput extends ToolContext {
  reason: string;
}

// ---------- A's other endpoints ----------

/** POST /api/chain/player-wallet — called by B after sign-in. Idempotent. */
export interface CreatePlayerWalletInput {
  user_id: string;
}
export interface CreatePlayerWalletResult {
  wallet_address: Hex;
}

/** GET /api/chain/run-status?run_id= — also triggers the receipt backup check. */
export interface RunStatusResult {
  run_id: string;
  outcome: RunOutcome | null;
  tx_hash: Hex | null;
  duration_ms: number | null;
  explorer_url: string | null;
}

// ---------- Vault events (QuickNode Stream -> POST /api/stream) ----------

/** Header that carries the Stream webhook token. */
export const STREAM_TOKEN_HEADER = "x-coldcall-stream-token";

/** Solidity signatures. topic0 = keccak256 of each. Order is not significant. */
export const VAULT_EVENT_SIGNATURES = [
  "TransferProposed(uint256,address,address,uint256,bytes32,string)",
  "TransferApproved(uint256,address,uint8)",
  "TransferRejected(uint256,address,uint8)",
  "TransferCancelled(uint256)",
  "TransferExecuted(uint256,address,uint256,bytes32)",
  "AllowlistProposed(uint256,address,address,bytes32)",
  "AllowlistApproved(uint256,address,uint8)",
  "AllowlistRejected(uint256,address,uint8)",
  "AllowlistCancelled(uint256)",
  "AllowlistQueued(uint256,address,uint64)",
  "AllowlistAdded(uint256,address,bytes32,uint256)",
  "AllowlistRemoved(address)",
] as const;

export type VaultEvent =
  | { event: "TransferProposed"; id: string; proposer: Hex; to: Hex; amount: string; runId: Hex; memo: string }
  | { event: "TransferApproved"; id: string; owner: Hex; approvals: number }
  | { event: "TransferRejected"; id: string; owner: Hex; rejections: number }
  | { event: "TransferCancelled"; id: string }
  | { event: "TransferExecuted"; id: string; to: Hex; amount: string; runId: Hex }
  | { event: "AllowlistProposed"; id: string; proposer: Hex; who: Hex; runId: Hex }
  | { event: "AllowlistApproved"; id: string; owner: Hex; approvals: number }
  | { event: "AllowlistRejected"; id: string; owner: Hex; rejections: number }
  | { event: "AllowlistCancelled"; id: string }
  | { event: "AllowlistQueued"; id: string; who: Hex; readyAt: number }
  | { event: "AllowlistAdded"; id: string; who: Hex; runId: Hex; at: number }
  | { event: "AllowlistRemoved"; who: Hex };

export type VaultEventName = VaultEvent["event"];

/** One log as the Stream filter sends it to the webhook (trimmed, not decoded). */
export interface StreamLog {
  address: Hex;
  topics: Hex[];
  data: Hex;
  transactionHash: Hex;
  logIndex: number;
  blockNumber: number;
  blockTimestamp: number; // seconds
}

/**
 * runId on chain is bytes32. It is the run uuid with the dashes removed,
 * left-padded with zeros to 32 bytes. Helpers live in server/chain.
 */

// ---------- Realtime ----------

/** Supabase Realtime: postgres changes on these tables, filtered by run_id. */
export const REALTIME_TABLES = {
  chainEvents: "chain_events",
  proposals: "proposals",
  suspicionEvents: "suspicion_events",
  runs: "runs",
} as const;

// ---------- Table rows ----------

export type RunOutcome = "breach" | "lockout" | "timeout" | "quit";
export type ProposalKind = "transfer" | "allowlist";
export type ProposalStatus =
  | "open"
  | "queued"
  | "executed"
  | "added"
  | "rejected"
  | "cancelled"
  | "expired";

export interface UserRow {
  id: string;
  display_name: string | null;
  wallet_address: Hex | null;
  circle_wallet_id: string | null;
  created_at: string;
}

export interface RunRow {
  id: string;
  user_id: string;
  floor: FloorId;
  cover: string | null;
  channel: Channel;
  started_at: string | null; // set at the first message
  ended_at: string | null;
  outcome: RunOutcome | null;
  tx_hash: Hex | null;
  duration_ms: number | null; // block timestamp of TransferExecuted minus started_at
  payout_units: string | null;
  is_first_clear: boolean;
  hints_used: number;
  daily_contract_id: string | null;
  created_at: string;
}

export interface ConversationRow {
  id: string;
  run_id: string;
  employee_id: EmployeeId;
  channel: Channel;
  elevenlabs_conversation_id: string | null;
  seconds_used: number;
  created_at: string;
}

export interface SuspicionEventRow {
  id: string;
  run_id: string;
  employee_id: EmployeeId;
  delta: number;
  reason: string;
  level_after: number;
  created_at: string;
}

export interface ProposalRow {
  id: string;
  vault: Hex;
  onchain_id: number;
  run_id: string;
  kind: ProposalKind;
  status: ProposalStatus;
  amount_units: string | null;
  claimed_name: string | null;
  claimed_amount_units: string | null;
  unlock_at: string | null;
  created_at: string;
}

export interface ChainEventRow {
  tx_hash: Hex;
  log_index: number;
  event: VaultEventName;
  vault: Hex;
  run_id: string | null;
  payload: VaultEvent;
  block_number: number;
  block_time: string;
  source: "stream" | "receipt"; // "receipt" = backup path
  created_at: string;
}

export interface LeaderboardRow {
  run_id: string;
  user_id: string;
  display_name: string | null;
  floor: FloorId;
  channel: Channel;
  duration_ms: number;
  tx_hash: Hex;
  ended_at: string;
  daily_contract_id: string | null;
}

// ---------- deployments/arc-testnet.json ----------

/** Written by contracts/script/Deploy.s.sol. Addresses are null until the first deploy. */
export interface Deployments {
  chainId: number;
  deployBlock: number | null; // backfill the Stream from this block
  usdc: Hex;
  admin: Hex | null; // house wallet
  tutorial: Hex | null;
  floor1: Hex | null;
  floor2: Hex | null;
  floor3: Hex | null;
}
