# Pretext: chain-side spec (owner A) and B handoff

Date: 2026-11-17. Owner A: Madhav (this repo session). Owner B: Audrey.
Base document: "Pretext — Hackathon Design & Execution Doc" (Nov 16). This spec records the
decisions from the interview that add to or change that document. Where they differ, this spec wins.
Deadline: submit Fri Nov 20, 11:00 AM CST target (hard limit 12:00 PM).

## 1. Submission targets (unchanged)

- Main track: Consumer Applications. Chain award: Best use of Arc.
- Bounties: ElevenLabs, QuickNode Streams.
- README must list: vault and employee wallet addresses with explorer links, how Arc is used,
  ElevenLabs products, Stream config (network, dataset, filter logic, destination, why).

## 2. Verified network facts (checked Nov 17; re-check with `cast` before use)

| Item | Value |
| --- | --- |
| Arc testnet RPC | `https://rpc.testnet.arc.io` (WebSocket `wss://rpc.testnet.arc.io`) |
| Chain ID | `5042002` |
| Explorer | `https://explorer.testnet.arc.io` |
| Faucet | `https://faucet.circle.com` |
| USDC ERC-20 interface | `0x3600000000000000000000000000000000000000`, **6 decimals** |
| Native gas token | USDC, **18 decimals**; same balance as the ERC-20 interface |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| QuickNode Streams | Arc testnet is in the supported-chains list and changelog |
| Circle developer-controlled wallets | `ARC-TESTNET` is a valid blockchain value; Circle tutorials execute contract calls on Arc testnet with the Node SDK |

Rules that follow from this:

- The vault uses only the ERC-20 interface. All amounts in contracts, tools and the database are
  6-decimal integer units. Never mix in the 18-decimal native value. Read `decimals()` in the deploy script and fail if it is not 6.
- Not yet proven: contract execution through Circle's API on Arc in our own account, and faucet limits. These are the first tasks (section 9).

## 3. Decisions from the interview

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Floor 2 con | Pure persuasion. The recipient is always the player's wallet. The approver's on-chain view shows it as "Unknown external address, not in vendor registry" next to the claimed name and amount. The player wins with a story that agrees with the dossier. No wallet labels, no planted vendor records. |
| 2 | Floor 3 | Beatable in two steps. A direct transfer always reverts (pitch beat). A player can get allowlisted, wait 60 s, then get paid. |
| 3 | Concurrency | All runs share the four vaults. Proposals are keyed by `runId`. Transactions are serialised per sending wallet. The allowlist is per player wallet. |
| 4 | Tx waiting | Tool handlers wait for the receipt for at most 5 s. On success they return the tx hash and ids. After 5 s they return `status: "pending"` and the Stream updates the UI. |
| 5 | Allowlist finalize | Lazy. On Floor 3, `propose_transfer` first finalizes a matured allowlist add for that player from the house wallet, then proposes. No cron, no finalize tool. |
| 6 | Payouts | Full amount on a player's first clear of each floor and on Daily Contract clears. All other clears pay the token amount, 0.01 USDC (`10000` units). |
| 7 | Allowlist reset | When a Floor 3 run ends (any outcome), the house wallet removes the player from the allowlist. |
| 8 | Tool auth | `run_id` and `employee_id` come from ElevenLabs dynamic variables, not from the LLM. The backend checks the shared secret header and checks that the ElevenLabs conversation id matches a row in `conversations` for that run. |
| 9 | Runtime | Everything stays on Vercel. Per-wallet serialisation uses a lease row in Postgres (section 6). |
| 10 | Timer | Run duration = block timestamp of the `TransferExecuted` log minus the server-recorded run start. Webhook delay does not change scores. |
| 11 | Amount | The LLM sends `amount_usdc`. The backend clamps it to `min(floor cap, payout allowed for this run, remaining daily budget)`. The response gives the amount actually used. |
| 12 | Player wallet | Circle developer-controlled wallet, one per user, created by the backend at first sign-in. Sign-in is Supabase Auth (email magic link). No client wallet SDK. |
| 13 | State writer | The Stream is the only normal writer of chain state. Backup: if a known receipt has no `chain_events` row after 10 s, the backend ingests that receipt's logs through the same idempotent handler. |
| 14 | Abuse limits | Daily payout budget per vault, per-user and per-IP run limits, per-user daily voice-minute cap, and `pause()`. When a budget is used up, runs pay the token amount. |
| 15 | Open proposals | Proposals expire on chain after 10 minutes. No cleanup transaction. After a rejection, a run may make one more proposal (maximum 2 per run); B applies a suspicion penalty. |
| 16 | Scaffold | A scaffolds the Next.js app, `shared/interfaces.ts` v1 and `.env.example`. Files under `app/api/tools/*`, `app/api/stream` and `app/api/chain/*` are thin wrappers owned by A. B owns the rest of `app/`. |
| 17 | Schema | A writes one initial migration with every table. After that each side adds its own timestamped migration files and does not edit the other's. |
| 18 | Stream filter | The Stream filter keeps logs from our four vault addresses whose `topic0` is one of our event signatures, and trims fields. The webhook decodes with viem and the contract ABI. The backup path uses the same decoder. |
| 19 | Leaderboard | One board per floor. Each row has a `voice` or `chat` badge and can be filtered. A run that used both counts as voice. |

## 4. Contract changes to `PretextVault`

Start from the base document's contract. Apply these changes:

- **Expiry.** Constructor setting `proposalTtl` (600 s). Each transfer proposal stores `expiresAt`. `approve` and `execute` revert after it. `getProposal` returns it.
- **Auto-execute.** `approve` executes the transfer when the threshold is reached. A 1-of-N vault executes inside `proposeTransfer`. Keep a public `execute` for the case where the transfer failed for lack of funds.
- **Allowlist removal.** Replace `resetAllowlist()` with admin-only `removeFromAllowlist(address who)`; emit `AllowlistRemoved(address indexed who)`.
- **Finalize.** `finalizeAllowlistAdd(id)` is callable by anyone after `allowlistDelay`. It emits `AllowlistAdded`.
- **Re-add.** A removed address can be proposed again (new id).
- **Events.** Add `runId` to `AllowlistAdded`. Event list is then: `TransferProposed`, `TransferApproved`, `TransferRejected`, `TransferExecuted`, `AllowlistProposed`, `AllowlistApproved`, `AllowlistAdded`, `AllowlistRemoved`.
- **Cap.** `perTransferCap` in 6-decimal units: 1, 5, 10, 25 USDC for tutorial and floors 1 to 3.

Extra Foundry tests (in addition to the base list):

- Approve and execute revert after expiry.
- Auto-execute happens at threshold; 1-of-N executes in the propose transaction.
- Remove from allowlist blocks the next proposal; re-add works after a new delay.
- Finalize is callable by a non-owner after the delay.
- One fork test against Arc testnet that moves real USDC through the ERC-20 interface and checks 6 decimals.

## 5. Tool endpoints (`/api/tools/<name>`)

Common rules for every tool:

1. Check the shared secret header. Reject if wrong.
2. Read `run_id`, `employee_id` and the conversation id from the request (dynamic variables). Check the conversation row. Reject if the run is not active, the talk time is used up, or the employee is not an owner of that floor's vault.
3. Return JSON that the agent can speak from. Never return raw errors; map a contract revert to a short reason (`over_cap`, `not_allowlisted`, `expired`, `already_approved`, `paused`).

Tool-specific behaviour:

- `propose_transfer`: reject if the run already has 2 proposals or one open proposal. On Floor 3, first try the lazy finalize. Clamp the amount (decision 11). Recipient is the run's player wallet. If the contract reverts with `not_allowlisted`, return that reason so the employee can say it; this is the Floor 3 pitch beat.
- `approve_transfer`: on floors 2 and 3, the first call returns the on-chain view (`claimed_name`, `claimed_amount`, `real_recipient_label`, `real_recipient_address`, `real_amount`) and does not sign. The second call with `confirm: true` signs.
- `reject_transfer`, `propose_allowlist_add`, `approve_allowlist_add`: as in the base document. `propose_allowlist_add` returns `unlock_at`.
- Lookups (`check_vendor_list`, `check_calendar`, `verify_employee`): A provides the route; the data comes from B's `content/hoardwell/*.json`.
- `report_suspicion`, `end_conversation`: B's handlers in `server/game`; A only adds the thin route.

## 6. Signer service (`server/chain`)

- One `Signer` interface with two implementations: `CircleSigner` (developer-controlled wallets, contract execution API) and `ViemSigner` (keys from env). Selected by `SIGNER_MODE`. Time limit for Circle: 2 hours; then switch to viem and continue.
- Wallets: house (admin), 7 employees (Barry, Penny, Dee, Annie, Bill, Cassius, Max), one per player.
- **Per-wallet lease.** Table `wallet_locks(wallet, locked_until, holder)`. A Postgres function takes the lease with one atomic `UPDATE ... WHERE locked_until < now()`. The handler holds the lease from submit until the receipt or the 5 s limit, then releases it. Lease length 15 s so a crashed function cannot block a wallet. Retry to take the lease for at most 3 s, then return `busy`.
- **Gas.** Each employee wallet holds a small USDC balance for gas. A script `scripts/topup.ts` refills employee wallets and vaults from the house wallet and prints all balances.
- **Budgets** (defaults; change in env): daily payout budget per vault = 20 times its cap; 10 runs per user per day; 30 runs per IP per day; 15 voice minutes per user per day (B enforces voice minutes).
- **Kill switch.** `scripts/pause.ts` calls `pause()` on all vaults.

## 7. Stream and chain state

- Stream: network Arc testnet; dataset logs (receipts if logs are not offered); filter as in decision 18; destination webhook `POST /api/stream` with a secret token header; backfill from the lowest vault deploy block.
- `/api/stream`: verify the token; decode each log; insert into `chain_events` with a unique key on `(tx_hash, log_index)`; then apply effects:
  - `TransferExecuted`: set run outcome, tx hash and duration (decision 10); write the leaderboard data; Realtime sends the breach alarm; queue the memory summary (B); on Floor 3 remove the player from the allowlist.
  - Other events: update `proposals` status.
- Backup path: after a tool handler gets a receipt, it schedules a check with Next.js `after()`. If the event row is missing after 10 s, it ingests the receipt logs through the same function. The run status endpoint does the same check when polled.
- Leaderboard: a SQL view over `runs` joined with `chain_events`; columns include channel badge and explorer link.
- If Streams cannot be made to work on Arc: the backup path becomes the main path, and the README says so.

## 8. Shared interface and schema

- `shared/interfaces.ts` v1 (A writes first): request and response types for every tool, the decoded event union, the `chain_events` payload shape, Realtime channel names, table row types, revert reason codes.
- Initial migration (A writes): `users`, `runs`, `conversations`, `suspicion_events`, `proposals`, `chain_events`, `player_memory`, `player_notes`, `daily_contracts`, `streaks`, `wallet_locks`, `payout_budget`. `runs` gains `channel`, `payout_units`, `is_first_clear`.
- `deployments/arc-testnet.json`: USDC address, vault addresses, deploy blocks, employee wallet addresses, explorer base URL.

## 9. A task order

Tonight and Tuesday morning:

1. Scaffold: Next.js app, `contracts/` Foundry project, `.env.example`, `CLAUDE.md` rules from the base document, `shared/interfaces.ts` v1, initial migration. Check: `npm run build` and `forge build` pass.
2. Network proof: `cast` reads the house wallet's USDC balance and `decimals()` returns 6. Claim faucet USDC.
3. `PretextVault` with all tests. Check: `forge test` is green.
4. Deploy the Floor 1 vault and fund it. Check: propose with `cast`, USDC moves, visible on the explorer.
5. Circle proof (2-hour limit): create a developer-controlled wallet on `ARC-TESTNET` and call `proposeTransfer` through the API. Else use `ViemSigner`.
6. Tool routes for propose, approve, reject and lookups, with the lease. Check: `curl` to `/api/tools/propose_transfer` returns a real tx hash.
7. Milestone with B: con Penny over chat; USDC arrives in the player wallet.

Wednesday: QuickNode Stream, `/api/stream`, backup path, leaderboard view, Floor 2 vault and two-step approve.
Thursday: Floor 3 vault, allowlist tools, lazy finalize, allowlist removal, budgets, top-up and pause scripts, player wallet creation at sign-in, demo reset script.
Friday: README sections for Arc and QuickNode; addresses and explorer links.

## 10. Handoff to B (Audrey's agent)

B's work is the base document's B tasks, with these changes from this spec:

1. **Do not scaffold.** A creates the Next.js app, `shared/interfaces.ts` v1 and the first migration. Pull before starting. B owns `app/` except `app/api/tools/*`, `app/api/stream`, `app/api/chain/*`.
2. **Sign-in is Supabase Auth with an email magic link.** No Circle client SDK. After sign-in, call A's endpoint to create the player wallet (name in `shared/interfaces.ts`).
3. **ElevenLabs tools:** configure `run_id`, `employee_id` and the conversation id as dynamic variables sent in the tool request. The LLM must not fill them. The backend creates the `conversations` row when the session starts, and stores the ElevenLabs conversation id.
4. **Floor 2 rule sheets (Annie, Bill):** the on-chain view always shows an unknown external address. Write the rule sheets so a mismatch raises suspicion, and a dossier-consistent reason (for example a payment-address change that agrees with a memo in the case file) can pass. Add that supporting material to `content/hoardwell/`.
5. **Floor 3 rule sheets (Cassius, Max):** a direct `propose_transfer` returns `not_allowlisted`; the employee must say this in character. The winning path is `propose_allowlist_add`, both approvals, a 60 s wait, then `propose_transfer`. The wait uses talk time, so the player may need to end the call and call back; sessions must allow that.
6. **Tool results:** handlers may return `status: "pending"` or a reason code. Each rule sheet needs a line for each code. An employee must never say an approval happened without `status: "executed"`.
7. **Amount:** the response gives the clamped amount. The employee states that amount, not the one asked for.
8. **Rejection:** a run may make one more proposal after a rejection; apply a suspicion penalty. A third attempt is refused by the backend.
9. **UI data:** the breach alarm and the proposal panel read from Realtime on `chain_events` and `proposals`. The run timer shown during play is a client estimate; the final time comes from the `runs` row.
10. **Leaderboard:** show the `voice` or `chat` badge and a filter.
11. **B enforces:** the per-user daily voice-minute cap and talk-time limits. B owns `report_suspicion` and `end_conversation` handlers in `server/game`; A adds the thin routes.
12. **First B tasks:** Penny's rule sheet v1 and ElevenLabs agent in chat mode; `content/hoardwell/*.json` v1 (vendors, directory, calendar); bare chat UI that creates a run and a conversation row. Then the base document's Wednesday and Thursday B tasks.

## 11. Open items

- Faucet limits per request and per day (decides how often to refill).
- Whether Circle's API contract execution works in our account on Arc (task 5).
- Naming decisions in the base document; none block the build.
