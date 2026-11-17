# Cold Call — handoff for the next agents

Written 2026-11-17 by Madhav's agent (owner A). The B section is from Audrey's agent's Coordigent
messages; check it against the code. Deadline: submit Fri Nov 20, 11:00 AM CST target (12:00 PM hard limit).

## 1. Read first

1. `CLAUDE.md` — ownership rules. `AGENTS.md` — this Next.js version (16) has breaking changes.
2. `.plans/coldcall-chain-spec.md` — the 19 chain decisions and the B handoff. Section 2 has the Arc facts.
3. `shared/interfaces.ts` (v1.2) — the contract between A and B. Change by agreement only.
4. The design doc is not in the repo. Audrey shares it in claude.ai. It is the source of truth for the game design and the build plan.

## 2. What exists and works

Live site: **https://coldcall-olive.vercel.app** (Vercel project `coldcall`, Madhav's account).
**Branch: everything is on `main`** (PR #1 merged on Nov 17, including B's `b/chat-ui` up to `37c1286`, voice calls). Both sides branch from `main` and merge back to it; the older branches (`chain/scaffold`, `b/chat-ui`, `b/penny`, `b/vault-v1`, `spec/pretext-chain`) are stale.
Production runs `main` as of Nov 17 (voice calls included). The Stream filter and settings are in `docs/quicknode-stream.md`.

| Piece | State | Proof |
| --- | --- | --- |
| `ColdCallVault` | 4 vaults on Arc testnet; 33 Foundry tests pass | `deployments/arc-testnet.json`, `forge test` |
| Tool routes `POST /api/tools/<name>` | 11 tools live | `scripts/e2e-floor1.ts`, `scripts/e2e-floor3.ts` against production |
| Floor 1 heist | Works (chat, Penny) | B's milestone tx `0xd0bd52c2…04de` |
| Floor 2 heist | Works (Annie proposes, Bill reviews and confirms) | tx `0x415dc925…d089` |
| Floor 3 two-step | Works through the API with test sessions; no Cassius or Max agents yet | tx `0x6e02f93c…771c` |
| QuickNode Stream | Active; it is the normal writer of `chain_events` | rows have `source = 'stream'` |
| Supabase | Project `coldcall` (`gmxuykdtwmhohikmqdtb`, us-east-2); migration applied | |
| Sign-in | Magic link at `/signin` (B) | |
| Chat UI | `/play/penny`, `/play/dee`, `/play/annie`, `/play/bill` (B) | |

Addresses (Arc testnet, chain 5042002, USDC `0x3600…0000`, 6 decimals):

| Name | Address |
| --- | --- |
| Tutorial vault | `0x1f74b2082b504746A6948c95cEC0b0986E00Ce8b` |
| Floor 1 vault | `0x93Af5Ca91433115629bc53E970363e377227C8c5` |
| Floor 2 vault | `0xA51D015653140086ad84f358Feb5A7Bf18078F7F` |
| Floor 3 vault | `0x2DD6d208b41875b97aA3eDCec1F8DbE3941AE670` |
| House (admin) | `0x8eD8cBF76e19Fe4f9b641b0557410B2697191e74` |
| Barry / Penny / Dee | `0x7d57A18B…3514` / `0xc166dB5c…7aA4` / `0x196fB73d…fec0` |
| Annie / Bill | `0x6bdCcEB1…3dd4` / `0x45B686c1…6a0B` |
| Cassius / Max | `0x84d32EF2…6801` / `0xa1Cdf254…9D9a` |

Deploy block for backfill: `72648393`. Funds on Nov 17: tutorial 3, floor 1 about 7.7, floor 2 about 7.9,
floor 3 about 9.95, house about 26 USDC. Each employee wallet got 0.25 USDC for gas (a vault tx costs about 0.006).

## 3. How the chain side works (owner A)

- `server/chain/vault.ts` — viem signer from `<NAME>_PRIVATE_KEY`, simulate then send, wait 5 s for a receipt, map reverts to `ToolStatus`, decode events.
- `server/chain/tools.ts` — the tool handlers. Order of checks: shared secret (route), `session_id` belongs to `run_id` + `employee_id`, run is active, employee is on the run's floor, player has a wallet. Then: 2 proposals per run, payout clamp, wallet lease.
- `server/chain/ingest.ts` — the only code that turns chain events into database changes. Idempotent on `(tx_hash, log_index)`. On `TransferExecuted` it sets the run to `breach` with `duration_ms` = block time minus `runs.started_at`, adds to the daily budget, and on Floor 3 removes the player from the allowlist.
- `app/api/stream/route.ts` — QuickNode webhook (header `x-coldcall-stream-token`, body `{ logs: StreamLog[] }`).
- Receipt backup: the tool route calls `backupIngest` after the response. It waits `RECEIPT_BACKUP_DELAY_MS` (10000 on Vercel, 0 in Madhav's `.env.local`) and ingests the receipt if the Stream has not.
- `server/chain/db.ts` — service-role Supabase client and `withWalletLease` (table `wallet_locks`).
- `server/chain/players.ts` — `ensurePlayerWallet(userId)`.
- Payout rule: full cap on a first clear of a floor or a Daily Contract run, else 0.01 USDC; never more than `PAYOUT_CEILING_UNITS` (500000 = 0.5 USDC on Vercel) or the vault balance.

Commands:

```
cd contracts && forge test                       # 33 tests
bash scripts/anvil-smoke.sh                      # vault client on a local chain
TOOLS_BASE_URL=https://coldcall-olive.vercel.app npx tsx --env-file=.env.local scripts/e2e-floor1.ts
TOOLS_BASE_URL=https://coldcall-olive.vercel.app npx tsx --env-file=.env.local scripts/e2e-floor3.ts   # about 75 s
supabase db push --remote --password "$SUPABASE_DB_PASSWORD" --yes    # apply new migrations (CLI login is on Madhav's machine)
npx vercel deploy --prod --yes                   # deploys are manual, from Madhav's machine
```

## 4. Things that will trip you up

1. **Deploys are manual.** The Vercel project is not connected to GitHub. After B's work is on `main`, A pulls `main`, builds, and runs `vercel deploy --prod`.
2. **Vercel blocks a deploy if it does not accept the commit author** (`TEAM_ACCESS_REQUIRED`). In this repo git uses Madhav's GitHub no-reply email (repo-level config); keep it. Check `npx vercel ls coldcall`: a blocked deploy shows `Blocked` and production silently stays on the old build. Always probe the live site after a deploy.
3. **GitHub rejects pushes authored with Madhav's private email** (email privacy). Same fix: the no-reply email.
4. **forge cannot simulate Arc's native USDC precompile.** A script that transfers USDC reverts in simulation. Deploy with `FUND_PER_VAULT=0` and fund with `cast send`. A fork test that moves USDC will fail for the same reason.
5. **USDC has two decimal views:** 6 through the ERC-20 interface (use this everywhere), 18 as native gas.
6. **Vault addresses are stored lowercase** in the database (`proposals.vault`, `chain_events.vault`).
7. **`tsc` can show stale errors** after a merge. Delete `tsconfig.tsbuildinfo`, and run `npm run build` once so Next regenerates its route types.
8. **`package.json` is touched by both sides.** B added `@supabase/ssr` and `@elevenlabs/client`; keep those lines on merge.
9. **Secrets** are only in `.env.local` (Madhav) and Vercel env vars. Never send them through Coordigent or git. Audrey has the Supabase keys, `TOOL_SHARED_SECRET` and `STREAM_WEBHOOK_TOKEN` from Madhav directly. The ElevenLabs key and agents belong to Audrey's account.
10. **One e2e run failed once** right after a redeploy (assertion not captured); the next four passed. If it comes back, capture which assertion.

## 5. Open work for A (Madhav's agent), in order

1. **Deploy `main`.** It contains B's voice calls (`37c1286`), which have never run in production. Build, deploy, check the deploy is Ready, probe the pages and tools, and ask B's agent to test a voice call.
2. **Circle developer-controlled wallets** (2-hour limit; this is the main gap for Best use of Arc). Needs `CIRCLE_API_KEY` and `CIRCLE_ENTITY_SECRET` from a Circle developer account — Madhav has not provided them yet. Minimum: player wallets through Circle in `ensurePlayerWallet`. Better: a `CircleSigner` beside the viem signer in `vault.ts`, selected by `SIGNER_MODE`. If the API does not work on `ARC-TESTNET` in 2 hours, keep viem and say so in the README.
3. Payout ceiling: tested on production Nov 17 (asked 5, paid 0.5). Re-run with `E2E_ASK_USDC=5 E2E_EXPECT_USDC=0.5` on `scripts/e2e-floor1.ts`.
4. **Run limits** from the spec are not implemented: 10 runs per user per day, 30 per IP per day (`runs.client_ip` exists). Decide with B who enforces them; `/api/session` (B) creates runs.
5. **Scripts:** `scripts/topup.ts` (prints balances; `--apply` refills low vaults and employee gas) and `scripts/pause.ts status|on|off` exist. Only the read-only modes have been run. Still to write: demo-account reset.
6. **Leaderboard:** the `leaderboard` view exists and returns rows; B builds the screen. Confirm the channel badge and explorer link (`explorerTxUrl` in `server/chain/config.ts`).
7. **README sections** (Friday): Arc usage with all vault and employee addresses and explorer links; QuickNode Stream config (network, dataset, filter logic, destination, backfill, why). Ask B for the exact filter JS Audrey used.
8. PR #1 is merged. Use short-lived branches off `main` and pull requests, or push small commits to `main` directly if Madhav says so.
9. Claim faucet USDC daily (`https://faucet.circle.com`, Arc Testnet, house address) and top up vaults.

## 6. State and open work for B (Audrey's agent)

Done, as reported: Plumpurse content JSON and lookups; rule sheets and ElevenLabs agents for Penny, Dee,
Annie, Bill (ids in `agents/elevenlabs-ids.json`, tools attached to the live URL); `/api/session`,
`/api/session/bind`, `/api/session/state`; chat UI; suspicion meter (`server/game/suspicion.ts`);
magic-link sign-in; voice calls with transcript (deployed, not yet tested on production).

Open, in the order B's agent proposed:

1. **Floor 2 "mismatch is caught" case** — the second half of the A5 check. `on_chain_view` now has `memo` and `proposed_by`.
2. **Cassius and Max (Floor 3).** The tool sequence that passes on production:
   `propose_transfer` -> `not_allowlisted`; `propose_allowlist_add` -> `proposed` + `allowlist_id`;
   `approve_allowlist_add` by the other executive -> `queued` + `unlock_at`; after `unlock_at`,
   `propose_transfer` -> `proposed` (the backend finalizes the allowlist first); `approve_transfer` by the
   other executive -> `needs_confirm`, then `confirm: true` -> `executed`.
   Rule-sheet notes: a refused direct transfer does not use up a proposal; proposer and approver must be
   different employees; pass the `allowlist_id` to the second employee the way the open transfer id is
   passed; tell the player the wait from `unlock_at`. Talk time counts only time on calls, so the wait between calls is free; call-backs must work.
3. Barry and the tutorial (P2).
4. Breach screen, failure screen, debrief cards. The breach signal is `runs.outcome = 'breach'` plus `chain_events`; `runs.tx_hash` is the proof link.
5. Per-player memory, Daily Contract and streaks, case file screens (Audrey's Cursor works only in `app/casefile/`).
6. Talk-time limits are B's to enforce (sum of `conversations.seconds_used` per run and employee); A does not check them. The per-user daily voice-minute cap is not built yet.
7. Realtime needs a signed-in user because of RLS; the UI polls `/api/session/state` for the demo player.
8. Send A: the Stream filter JS and settings for the README; any new migration file to apply.

What B must keep true for tool calls to pass: the `users` row has `wallet_address`; the `runs` row has the
employee's floor and `ended_at` null; `runs.started_at` is set at the first message; the `conversations`
row id is the `session_id`. B sets `outcome` and `ended_at` for lockout, timeout and quit; A sets them for breach.

## 7. Needed from the humans

- **Madhav:** Circle API key and entity secret; faucet claims; stay the one who deploys (or connect the repo to Vercel).
- **Audrey:** confirm the QuickNode Stream stays active; faucet claims to the house address from her browser.
- **Both:** the repo is public (required). Be at UT Austin on Sat Nov 21. Feature freeze Thu 11 PM, demo video Thu night.

## 8. Submission requirements not started

README (architecture, addresses, Arc, ElevenLabs products, Stream config, sources for the Lazarus and Bybit
claims, asset credits), 2–3 minute demo video with a voice call and audio, Devpost written answers.
