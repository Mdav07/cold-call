// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ColdCallVault} from "../src/ColdCallVault.sol";

/// @notice Replaces the Floor 3 vault with one whose allowlist additions take effect at once
///         (allowlistDelay 0; the delay is immutable, so it needs a new vault). Copies owners, threshold,
///         cap, admin, USDC and proposal TTL from the current Floor 3 vault and writes the new address to
///         ../deployments/<DEPLOYMENTS_NAME>.json under "floor3". Funding is a separate step
///         (old vault: admin sweep; then a top-up), so this script moves no money.
///
/// Run:
///   forge script script/DeployFloor3NoDelay.s.sol --rpc-url arc_testnet --broadcast --private-key $HOUSE_PRIVATE_KEY
contract DeployFloor3NoDelay is Script {
    function run() external returns (address floor3) {
        string memory name = vm.envOr("DEPLOYMENTS_NAME", string("arc-testnet"));
        string memory path = string.concat("../deployments/", name, ".json");
        ColdCallVault old = ColdCallVault(vm.parseJsonAddress(vm.readFile(path), ".floor3"));

        address[] memory owners = old.owners();
        uint8 threshold = old.threshold();
        uint256 cap = old.perTransferCap();
        uint64 ttl = old.proposalTtl();
        address admin = old.admin();
        address usdc = address(old.usdc());
        require(old.allowlistDelay() != 0, "floor3 already has no delay");

        vm.startBroadcast();
        floor3 = address(new ColdCallVault(usdc, owners, threshold, cap, true, 0, admin, ttl));
        vm.stopBroadcast();

        vm.writeJson(vm.toString(floor3), path, ".floor3");
        console2.log("old floor3", address(old));
        console2.log("new floor3", floor3);
    }
}
