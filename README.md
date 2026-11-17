# Cold Call

A social-engineering heist game. You phone the staff of Plumpurse Savings & Trust (AI voice and chat
agents), talk them into approving a payment, and the payment is a real USDC transfer on Arc testnet.
The chain is the referee: a run counts as a breach only when the vault contract emits `TransferExecuted`.

- Live: https://coldcall-olive.vercel.app
- Built for the UBC 2026 hackathon (Consumer Applications; Arc; ElevenLabs; QuickNode Streams).
- Testnet only. No real money is involved.

<!-- B: game overview, ElevenLabs products used, screenshots, asset credits, and sources go here. -->

## Architecture

```
Player (browser)
  -> ElevenLabs agent (voice or chat), one per employee
       -> server tools: POST /api/tools/<name>      (Next.js on Vercel)
            -> ColdCallVault on Arc testnet          (employee wallets sign)
                 -> QuickNode Stream (vault events)
                      -> POST /api/stream            (decode, store, end the run)
                           -> Supabase (runs, proposals, chain_events, leaderboard)
                                -> browser (breach screen, leaderboard)
```

The language model never holds a key and never decides the amount or the recipient. A tool call carries
a `session_id` that the backend checks against the run and the employee; the backend clamps the amount
and always pays the player's own wallet.

## Arc

Everything of value in the game happens on Arc testnet (chain ID `5042002`), in USDC.

- **`ColdCallVault`** (`contracts/src/ColdCallVault.sol`, 33 Foundry tests) is a small multi-approval
  vault. Each floor is one deployment with stricter rules:

  | Floor | Rule enforced by the contract | Address |
  | --- | --- | --- |
  | Tutorial | 1 approval | [`0x1f74b2082b504746A6948c95cEC0b0986E00Ce8b`](https://explorer.testnet.arc.io/address/0x1f74b2082b504746A6948c95cEC0b0986E00Ce8b) |
  | 1 | 1 approval, per-transfer cap | [`0x93Af5Ca91433115629bc53E970363e377227C8c5`](https://explorer.testnet.arc.io/address/0x93Af5Ca91433115629bc53E970363e377227C8c5) |
  | 2 | 2 approvals from different employees | [`0xA51D015653140086ad84f358Feb5A7Bf18078F7F`](https://explorer.testnet.arc.io/address/0xA51D015653140086ad84f358Feb5A7Bf18078F7F) |
  | 3 | 2 approvals, recipient allowlist, 60-second timelock on allowlist adds | [`0x2DD6d208b41875b97aA3eDCec1F8DbE3941AE670`](https://explorer.testnet.arc.io/address/0x2DD6d208b41875b97aA3eDCec1F8DbE3941AE670) |

  Proposals expire on chain after 10 minutes. On Floor 3 the player is removed from the allowlist when
  the run ends, so every run has to earn it again.
- **USDC as the only asset.** Vaults hold and pay USDC through the ERC-20 interface at
  `0x3600000000000000000000000000000000000000` (6 decimals). The employee wallets pay gas in the same
  USDC, so there is no second token to fund.
- **Each employee is an owner wallet** of their floor's vault. A tool call from that employee's agent
  becomes a transaction from that wallet, so the explorer shows who proposed and who approved.
- **Fast finality is part of the game.** The run timer stops at the block timestamp of
  `TransferExecuted`, and the breach screen links to the transaction.

Wallets: house/admin `0x8eD8cBF76e19Fe4f9b641b0557410B2697191e74`; Barry `0x7d57A18B9A52Bde97bc39847DFF2F681Ca713514`;
Penny `0xc166dB5c8E868ef7E21a20247b4B7C582A677aA4`; Dee `0x196fB73d55E6aFf851E9e4674f81E3aB2687fec0`;
Annie `0x6bdCcEB1314074CC84D0f0141Cf487Ee3E3e3dd4`; Bill `0x45B686c1f3599EA5e60B9407935264eA31D66a0B`;
Cassius `0x84d32EF22Ad79A9bbE0cB658bD155Da512A96801`; Max `0xa1Cdf25436cdf588cEB8706C0C6EF4A407fE9D9a`.

Example heists: Floor 1 [`0xd0bd52c2…04de`](https://explorer.testnet.arc.io/tx/0xd0bd52c2359148cf61b0a5093dfe75c3e6f9cd3ef3bccc33e3fb14900a7704de),
Floor 2 [`0x415dc925…d089`](https://explorer.testnet.arc.io/tx/0x415dc925ae26763ff39363b6500c76beae0aa033fd74025bcc829e28deced089),
Floor 3 [`0x6e02f93c…771c`](https://explorer.testnet.arc.io/tx/0x6e02f93c37f398a4080543bfde6ff293754733823aa7f5ab83eab67bc337771c).

- **Player wallets are Circle developer-controlled wallets** on Arc testnet (`ARC-TESTNET`), created on
  first play (`server/chain/players.ts`). The player's winnings land there.

Current limit: the employee and house wallets are plain testnet keys held in server environment variables.

## QuickNode Streams

The Stream is how the game learns what happened on chain. Nothing in the app marks a run as won; the
webhook does, when the Stream delivers `TransferExecuted`.

- Stream `coldcall-vault-events`: Arc Testnet, dataset Block with Receipts, backfilled from the vaults'
  deploy block (`72648393`) so the leaderboard history can be rebuilt from the chain.
- A JavaScript filter keeps only logs from the 4 vaults whose topic0 is one of the 12 game events.
- Destination: `POST /api/stream` with a secret header. The route (`app/api/stream/route.ts`) decodes
  the logs with the contract ABI and passes them to one idempotent writer (`server/chain/ingest.ts`,
  keyed on transaction hash + log index), which stores the event, updates the proposal, ends the run,
  and records the duration and payout.
- If the Stream has not delivered a transaction's events 10 seconds after the receipt, the same writer
  ingests them from the receipt. Rows record which path wrote them (`chain_events.source`).

Full settings and the filter code: [`docs/quicknode-stream.md`](docs/quicknode-stream.md).

## Run it locally

```
npm install
cp .env.example .env.local     # fill in the values
npm run dev

cd contracts && forge test                                        # contract tests
npx tsx --env-file=.env.local scripts/e2e-floor1.ts               # a real Floor 1 heist through the API
npx tsx --env-file=.env.local scripts/topup.ts                    # balances (add --apply to refill)
npx tsx --env-file=.env.local scripts/pause.ts status             # kill switch: status | on | off
```

Repo layout and ownership are in `CLAUDE.md`; the chain design decisions are in
`.plans/coldcall-chain-spec.md`.
