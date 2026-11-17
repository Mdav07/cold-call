// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ColdCallVault} from "../src/ColdCallVault.sol";

interface IERC20Transfer {
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @notice Deploys the tutorial vault and the three floor vaults, optionally funds them,
///         and writes every address to ../deployments/<DEPLOYMENTS_NAME>.json.
///
/// Required env:
///   USDC_ADDRESS        USDC ERC-20 address on the target chain
///   ADMIN_ADDRESS       house wallet (admin of every vault)
///   TUTORIAL_OWNERS     comma-separated employee wallet addresses, e.g. "0xabc"
///   FLOOR1_OWNERS       e.g. "0xpenny,0xdee"
///   FLOOR2_OWNERS       e.g. "0xannie,0xbill"
///   FLOOR3_OWNERS       e.g. "0xcassius,0xmax"
/// Optional env (defaults in brackets):
///   USDC_DECIMALS [6]  TUTORIAL_CAP [1]  FLOOR1_CAP [5]  FLOOR2_CAP [10]  FLOOR3_CAP [25]   (whole USDC)
///   FLOOR1_THRESHOLD [1]  FLOOR2_THRESHOLD [2]  FLOOR3_THRESHOLD [2]
///   FLOOR3_ALLOWLIST_DELAY [60] seconds
///   PROPOSAL_TTL [600] seconds a transfer proposal stays approvable
///   FUND_PER_VAULT [0] whole USDC sent from the broadcaster to each vault after deploy
///                  Leave at 0 on Arc: forge's local simulation cannot run Arc's native USDC
///                  precompile, so the script reverts. Fund with `cast send` after the deploy.
///   DEPLOYMENTS_NAME ["arc-testnet"]
///
/// Run:
///   forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast --private-key $HOUSE_PRIVATE_KEY
contract Deploy is Script {
    struct Deployed {
        address tutorial;
        address floor1;
        address floor2;
        address floor3;
    }

    function run() external returns (Deployed memory d) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        uint256 unit = 10 ** vm.envOr("USDC_DECIMALS", uint256(6));

        address[] memory tutorialOwners = vm.envAddress("TUTORIAL_OWNERS", ",");
        address[] memory floor1Owners = vm.envAddress("FLOOR1_OWNERS", ",");
        address[] memory floor2Owners = vm.envAddress("FLOOR2_OWNERS", ",");
        address[] memory floor3Owners = vm.envAddress("FLOOR3_OWNERS", ",");

        uint256 fund = vm.envOr("FUND_PER_VAULT", uint256(0)) * unit;
        uint256 startBlock = block.number;
        uint64 ttl = uint64(vm.envOr("PROPOSAL_TTL", uint256(600)));

        vm.startBroadcast();

        d.tutorial = address(
            new ColdCallVault(
                usdc, tutorialOwners, 1, vm.envOr("TUTORIAL_CAP", uint256(1)) * unit, false, 0, admin, ttl
            )
        );
        d.floor1 = address(
            new ColdCallVault(
                usdc,
                floor1Owners,
                uint8(vm.envOr("FLOOR1_THRESHOLD", uint256(1))),
                vm.envOr("FLOOR1_CAP", uint256(5)) * unit,
                false,
                0,
                admin,
                ttl
            )
        );
        d.floor2 = address(
            new ColdCallVault(
                usdc,
                floor2Owners,
                uint8(vm.envOr("FLOOR2_THRESHOLD", uint256(2))),
                vm.envOr("FLOOR2_CAP", uint256(10)) * unit,
                false,
                0,
                admin,
                ttl
            )
        );
        d.floor3 = address(
            new ColdCallVault(
                usdc,
                floor3Owners,
                uint8(vm.envOr("FLOOR3_THRESHOLD", uint256(2))),
                vm.envOr("FLOOR3_CAP", uint256(25)) * unit,
                true,
                uint64(vm.envOr("FLOOR3_ALLOWLIST_DELAY", uint256(60))),
                admin,
                ttl
            )
        );

        if (fund > 0) {
            require(IERC20Transfer(usdc).transfer(d.tutorial, fund), "fund tutorial");
            require(IERC20Transfer(usdc).transfer(d.floor1, fund), "fund floor1");
            require(IERC20Transfer(usdc).transfer(d.floor2, fund), "fund floor2");
            require(IERC20Transfer(usdc).transfer(d.floor3, fund), "fund floor3");
        }

        vm.stopBroadcast();

        _write(d, usdc, admin, startBlock);

        console2.log("tutorial", d.tutorial);
        console2.log("floor1  ", d.floor1);
        console2.log("floor2  ", d.floor2);
        console2.log("floor3  ", d.floor3);
    }

    function _write(Deployed memory d, address usdc, address admin, uint256 startBlock) internal {
        string memory k = "deployments";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeUint(k, "deployBlock", startBlock);
        vm.serializeAddress(k, "usdc", usdc);
        vm.serializeAddress(k, "admin", admin);
        vm.serializeAddress(k, "tutorial", d.tutorial);
        vm.serializeAddress(k, "floor1", d.floor1);
        vm.serializeAddress(k, "floor2", d.floor2);
        string memory json = vm.serializeAddress(k, "floor3", d.floor3);

        string memory name = vm.envOr("DEPLOYMENTS_NAME", string("arc-testnet"));
        vm.writeJson(json, string.concat("../deployments/", name, ".json"));
    }
}
