#!/usr/bin/env bash
# Starts anvil, deploys a mock USDC and Floor 2 / Floor 3 vaults, then runs scripts/anvil-smoke.ts.
# Uses anvil's public test mnemonic only. Run from the repo root: bash scripts/anvil-smoke.sh
set -euo pipefail

RPC=http://127.0.0.1:8545
anvil --silent --chain-id 5042002 &
ANVIL_PID=$!
trap 'kill $ANVIL_PID 2>/dev/null || true' EXIT
until cast chain-id --rpc-url $RPC >/dev/null 2>&1; do sleep 0.2; done

# anvil default accounts 0..5, derived from its public test mnemonic
M="test test test test test test test test test test test junk"
key() { cast wallet private-key "$M" "$1"; }
export HOUSE_PRIVATE_KEY=$(key 0)
export ANNIE_PRIVATE_KEY=$(key 1)
export BILL_PRIVATE_KEY=$(key 2)
export CASSIUS_PRIVATE_KEY=$(key 3)
export MAX_PRIVATE_KEY=$(key 4)
export PENNY_PRIVATE_KEY=$(key 5)

addr() { cast wallet address --private-key "$1"; }
HOUSE=$(addr $HOUSE_PRIVATE_KEY)

deploy() { # prints the deployed address
  forge create --root contracts --rpc-url $RPC --private-key $HOUSE_PRIVATE_KEY --broadcast "$@" \
    | awk '/Deployed to:/ {print $3}'
}

USDC=$(deploy test/mocks/MockUSDC.sol:MockUSDC)
F2=$(deploy src/ColdCallVault.sol:ColdCallVault --constructor-args \
  "$USDC" "[$(addr $ANNIE_PRIVATE_KEY),$(addr $BILL_PRIVATE_KEY)]" 2 10000000 false 0 "$HOUSE" 600)
F3=$(deploy src/ColdCallVault.sol:ColdCallVault --constructor-args \
  "$USDC" "[$(addr $CASSIUS_PRIVATE_KEY),$(addr $MAX_PRIVATE_KEY)]" 2 25000000 true 60 "$HOUSE" 600)

for v in $F2 $F3; do
  cast send "$USDC" "mint(address,uint256)" "$v" 100000000 --rpc-url $RPC --private-key $HOUSE_PRIVATE_KEY >/dev/null
done

ARC_TESTNET_RPC_URL=$RPC SMOKE_FLOOR2=$F2 SMOKE_FLOOR3=$F3 npx tsx scripts/anvil-smoke.ts
