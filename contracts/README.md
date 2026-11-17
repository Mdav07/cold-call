# Cold Call — vault contracts

`ColdCallVault` is the N-of-M treasury the AI employees guard. One contract, deployed four times (tutorial + three floors) with different settings. The AI can be talked into calling tools; the contract enforces what it can't be talked out of.

| Vault | Owners (employee wallets) | Threshold | Cap (USDC) | Allowlist | Delay |
| --- | --- | --- | --- | --- | --- |
| Tutorial | Barry | 1 | 1 | no | – |
| Floor 1 Petty Cash | Penny, Dee | 1 | 5 | no | – |
| Floor 2 Operations | Annie, Bill | 2 | 10 | no | – |
| Floor 3 Treasury | Cassius, Max | 2 | 25 | yes | 60 s |

## Behavior

- `proposeTransfer(to, amount, runId, memo)` — owners only. The proposer's approval counts immediately, so a 1-of-N vault pays out in the same transaction.
- `approveTransfer(id)` — owners only, once each. **Executes automatically** when approvals reach the threshold.
- `rejectTransfer(id)` — cancels once the threshold can no longer be reached.
- Reverts above `perTransferCap`, and (Floor 3) for any recipient not on the allowlist — checked at proposal *and* at execution.
- `proposeAllowlistAdd(who, runId)` / `approveAllowlistAdd(id)` — threshold approvals queue the address behind `allowlistDelay`; then anyone calls `finalizeAllowlistAdd(id)`.
- Admin (house wallet): `sweep`, `setPaused`, `resetAllowlist` (demo resets). Refill = plain USDC transfer into the vault.
- Views for the backend and the Floor 2 on-chain check: `getTransfer(id)`, `getAllowlistProposal(id)`, `transferCount()`, `owners()`, `allowlist()`, `balance()`.

`runId` (bytes32) ties every event to a game run so the Stream webhook can stop the right timer and write the right leaderboard row. Suggested encoding: `keccak256(bytes(runUuid))`, stored in Supabase alongside the run.

## Events (for the QuickNode Stream filter)

```
TransferProposed(uint256 indexed id, address indexed proposer, address indexed to, uint256 amount, bytes32 runId, string memo)
TransferApproved(uint256 indexed id, address indexed owner, uint8 approvals)
TransferRejected(uint256 indexed id, address indexed owner, uint8 rejections)
TransferCancelled(uint256 indexed id)
TransferExecuted(uint256 indexed id, address indexed to, uint256 amount, bytes32 runId)
AllowlistProposed(uint256 indexed id, address indexed proposer, address indexed who, bytes32 runId)
AllowlistApproved(uint256 indexed id, address indexed owner, uint8 approvals)
AllowlistRejected(uint256 indexed id, address indexed owner, uint8 rejections)
AllowlistCancelled(uint256 indexed id)
AllowlistQueued(uint256 indexed id, address indexed who, uint64 readyAt)
AllowlistAdded(uint256 indexed id, address indexed who, uint256 at)
```

Topic0 hashes: `cast sig-event "TransferExecuted(uint256,address,uint256,bytes32)"` etc. The ABI is exported to `../shared/abi/ColdCallVault.json`.

## Test

```bash
forge test -vv
```

29 tests: access control, threshold, double votes, cancellation, cap (+ fuzz), empty vault, allowlist + timelock (`vm.warp`), reset, pause, sweep, events.

## Deploy to Arc testnet

1. Copy `../.env.example` to `../.env` and fill in the Arc RPC URL, USDC address, house key and the employee wallet addresses (Circle developer-controlled wallets, or viem fallback keys).
2. Fund the house wallet from the Circle testnet faucet.
3. Deploy, fund each vault, and write `../deployments/arc-testnet.json`:

```bash
source ../.env
forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast --private-key $HOUSE_PRIVATE_KEY
```

4. Smoke test (Floor 1 heist by hand):

```bash
cast send $FLOOR1 "proposeTransfer(address,uint256,bytes32,string)" $PLAYER 1000000 $(cast keccak run-smoke) "smoke test" \
  --rpc-url arc_testnet --private-key $PENNY_PRIVATE_KEY
```

**Verify on day one:** Arc testnet chain ID and RPC, the USDC ERC-20 address and its decimals (the script assumes 6; override with `USDC_DECIMALS`), and the explorer URL — from the Arc docs and Circle's USDC contract addresses page.
