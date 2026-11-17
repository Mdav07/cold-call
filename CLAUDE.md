# Cold Call — rules for coding agents

@AGENTS.md

Two agents share this repo through Coordigent. A = chain owner (Madhav). B = game owner (Audrey).

## Read first

- `.plans/coldcall-chain-spec.md` (chain decisions and the B handoff) and the design doc when it is in `docs/`.
- `shared/interfaces.ts` is the contract between A and B.

## Ownership

| Path | Owner |
| --- | --- |
| `contracts/`, `deployments/`, `server/chain/`, `scripts/` | A |
| `app/api/tools/*`, `app/api/stream`, `app/api/chain/*` | A (thin wrappers only) |
| `app/` (everything else), `server/game/`, `agents/`, `content/plumpurse/` | B |
| `supabase/migrations/` | A wrote the first file; after that each side adds its own timestamped files and does not edit the other's |
| `shared/interfaces.ts`, `docs/`, `README.md` | Both, by agreement |

## Rules

1. Only edit files you own. For a change elsewhere, message the other agent through Coordigent.
2. To change `shared/interfaces.ts`: propose, wait for agreement, then update both sides in one commit.
3. Never commit secrets. Keys live in `.env.local` and Vercel env vars. Keep `.env.example` current.
4. Testnet only. Never point anything at mainnet.
5. USDC amounts are 6-decimal integer units (ERC-20 interface). Never use the 18-decimal native value.
6. Small commits with clear messages. The humans review and understand every merge.
7. Run the check for a step before starting the next one: `npm run build`, `forge test` (in `contracts/`).
