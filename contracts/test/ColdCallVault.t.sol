// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ColdCallVault} from "../src/ColdCallVault.sol";
import {MockUSDC, FalseReturningToken} from "./mocks/MockUSDC.sol";

contract ColdCallVaultTest is Test {
    uint256 constant USDC = 1e6;
    bytes32 constant RUN = keccak256("run-1");

    MockUSDC usdc;
    address admin = makeAddr("house");
    address penny = makeAddr("penny");
    address dee = makeAddr("dee");
    address annie = makeAddr("annie");
    address bill = makeAddr("bill");
    address cassius = makeAddr("cassius");
    address max = makeAddr("max");
    address player = makeAddr("player");
    address stranger = makeAddr("stranger");

    ColdCallVault floor1; // 1-of-2, cap 5
    ColdCallVault floor2; // 2-of-2, cap 10
    ColdCallVault floor3; // 2-of-2, cap 25, allowlist + 60s delay

    // Mirror of the vault's events for vm.expectEmit
    event TransferProposed(
        uint256 indexed id, address indexed proposer, address indexed to, uint256 amount, bytes32 runId, string memo
    );
    event TransferApproved(uint256 indexed id, address indexed owner, uint8 approvals);
    event TransferRejected(uint256 indexed id, address indexed owner, uint8 rejections);
    event TransferCancelled(uint256 indexed id);
    event TransferExecuted(uint256 indexed id, address indexed to, uint256 amount, bytes32 runId);
    event AllowlistProposed(uint256 indexed id, address indexed proposer, address indexed who, bytes32 runId);
    event AllowlistQueued(uint256 indexed id, address indexed who, uint64 readyAt);
    event AllowlistAdded(uint256 indexed id, address indexed who, bytes32 runId, uint256 at);
    event AllowlistRemoved(address indexed who);

    function setUp() public {
        usdc = new MockUSDC();
        floor1 = new ColdCallVault(address(usdc), _pair(penny, dee), 1, 5 * USDC, false, 0, admin, 600);
        floor2 = new ColdCallVault(address(usdc), _pair(annie, bill), 2, 10 * USDC, false, 0, admin, 600);
        floor3 = new ColdCallVault(address(usdc), _pair(cassius, max), 2, 25 * USDC, true, 60, admin, 600);
        usdc.mint(address(floor1), 100 * USDC);
        usdc.mint(address(floor2), 100 * USDC);
        usdc.mint(address(floor3), 100 * USDC);
    }

    function _pair(address a, address b) internal pure returns (address[] memory arr) {
        arr = new address[](2);
        arr[0] = a;
        arr[1] = b;
    }

    // ------------------------------------------------------------------
    // Constructor validation
    // ------------------------------------------------------------------

    function test_constructor_rejectsBadConfig() public {
        address[] memory empty = new address[](0);
        vm.expectRevert(ColdCallVault.InvalidConfig.selector);
        new ColdCallVault(address(usdc), empty, 1, USDC, false, 0, admin, 600);

        vm.expectRevert(ColdCallVault.InvalidConfig.selector);
        new ColdCallVault(address(usdc), _pair(penny, dee), 3, USDC, false, 0, admin, 600); // threshold > owners

        vm.expectRevert(ColdCallVault.InvalidConfig.selector);
        new ColdCallVault(address(usdc), _pair(penny, dee), 0, USDC, false, 0, admin, 600); // zero threshold

        vm.expectRevert(ColdCallVault.InvalidConfig.selector);
        new ColdCallVault(address(usdc), _pair(penny, penny), 1, USDC, false, 0, admin, 600); // duplicate owner

        vm.expectRevert(ColdCallVault.InvalidConfig.selector);
        new ColdCallVault(address(usdc), _pair(penny, dee), 1, 0, false, 0, admin, 600); // zero cap

        vm.expectRevert(ColdCallVault.InvalidConfig.selector);
        new ColdCallVault(address(usdc), _pair(penny, dee), 1, USDC, false, 60, admin, 600); // delay without allowlist

        vm.expectRevert(ColdCallVault.InvalidConfig.selector);
        new ColdCallVault(address(usdc), _pair(penny, dee), 1, USDC, false, 0, admin, 0); // zero ttl

        vm.expectRevert(ColdCallVault.ZeroAddress.selector);
        new ColdCallVault(address(0), _pair(penny, dee), 1, USDC, false, 0, admin, 600);
    }

    function test_constructor_storesConfig() public view {
        assertEq(floor3.threshold(), 2);
        assertEq(floor3.perTransferCap(), 25 * USDC);
        assertTrue(floor3.allowlistEnabled());
        assertEq(floor3.allowlistDelay(), 60);
        assertEq(floor3.admin(), admin);
        assertTrue(floor3.isOwner(cassius));
        assertEq(floor3.owners().length, 2);
    }

    // ------------------------------------------------------------------
    // Access control
    // ------------------------------------------------------------------

    function test_nonOwner_cannotPropose() public {
        vm.prank(stranger);
        vm.expectRevert(ColdCallVault.NotOwner.selector);
        floor1.proposeTransfer(player, USDC, RUN, "");
    }

    function test_nonOwner_cannotApproveOrReject() public {
        vm.prank(annie);
        uint256 id = floor2.proposeTransfer(player, USDC, RUN, "invoice");

        vm.startPrank(stranger);
        vm.expectRevert(ColdCallVault.NotOwner.selector);
        floor2.approveTransfer(id);
        vm.expectRevert(ColdCallVault.NotOwner.selector);
        floor2.rejectTransfer(id);
        vm.stopPrank();
    }

    function test_ownerOfOtherFloor_cannotAct() public {
        vm.prank(penny); // Floor 1 owner trying Floor 2
        vm.expectRevert(ColdCallVault.NotOwner.selector);
        floor2.proposeTransfer(player, USDC, RUN, "");
    }

    function test_adminOnlyFunctions() public {
        vm.startPrank(stranger);
        vm.expectRevert(ColdCallVault.NotAdmin.selector);
        floor1.sweep(stranger, USDC);
        vm.expectRevert(ColdCallVault.NotAdmin.selector);
        floor1.setPaused(true);
        vm.expectRevert(ColdCallVault.NotAdmin.selector);
        floor3.removeFromAllowlist(player);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Floor 1: 1-of-2 executes on proposal
    // ------------------------------------------------------------------

    function test_floor1_proposeExecutesImmediately() public {
        vm.expectEmit(true, true, true, true, address(floor1));
        emit TransferProposed(0, penny, player, 5 * USDC, RUN, "Quillfeather invoice");
        vm.expectEmit(true, true, false, true, address(floor1));
        emit TransferApproved(0, penny, 1);
        vm.expectEmit(true, true, false, true, address(floor1));
        emit TransferExecuted(0, player, 5 * USDC, RUN);

        vm.prank(penny);
        floor1.proposeTransfer(player, 5 * USDC, RUN, "Quillfeather invoice");

        assertEq(usdc.balanceOf(player), 5 * USDC);
        assertEq(uint8(floor1.getTransfer(0).status), uint8(ColdCallVault.Status.Executed));
    }

    // ------------------------------------------------------------------
    // Floor 2: threshold of 2
    // ------------------------------------------------------------------

    function test_floor2_belowThreshold_doesNotExecute() public {
        vm.prank(annie);
        uint256 id = floor2.proposeTransfer(player, 10 * USDC, RUN, "vendor payment");
        assertEq(usdc.balanceOf(player), 0);
        ColdCallVault.TransferProposal memory p = floor2.getTransfer(id);
        assertEq(p.approvals, 1);
        assertEq(uint8(p.status), uint8(ColdCallVault.Status.Pending));
        assertEq(p.to, player); // the "real on-chain recipient" the second approver sees
        assertEq(p.memo, "vendor payment");
    }

    function test_floor2_secondApprovalExecutes() public {
        vm.prank(annie);
        uint256 id = floor2.proposeTransfer(player, 10 * USDC, RUN, "vendor payment");

        vm.expectEmit(true, true, false, true, address(floor2));
        emit TransferExecuted(id, player, 10 * USDC, RUN);
        vm.prank(bill);
        floor2.approveTransfer(id);

        assertEq(usdc.balanceOf(player), 10 * USDC);
    }

    function test_cannotApproveTwice() public {
        vm.prank(annie);
        uint256 id = floor2.proposeTransfer(player, USDC, RUN, "");
        vm.prank(annie);
        vm.expectRevert(abi.encodeWithSelector(ColdCallVault.AlreadyVoted.selector, id, annie));
        floor2.approveTransfer(id);
    }

    function test_cannotApproveExecutedTwice() public {
        vm.prank(annie);
        uint256 id = floor2.proposeTransfer(player, USDC, RUN, "");
        vm.prank(bill);
        floor2.approveTransfer(id);
        vm.prank(bill);
        vm.expectRevert(abi.encodeWithSelector(ColdCallVault.NotPending.selector, id));
        floor2.approveTransfer(id);
        assertEq(usdc.balanceOf(player), USDC); // paid exactly once
    }

    function test_reject_cancelsWhenThresholdUnreachable() public {
        vm.prank(annie);
        uint256 id = floor2.proposeTransfer(player, USDC, RUN, "");

        vm.expectEmit(true, true, false, true, address(floor2));
        emit TransferRejected(id, bill, 1);
        vm.expectEmit(true, false, false, true, address(floor2));
        emit TransferCancelled(id);
        vm.prank(bill);
        floor2.rejectTransfer(id);

        assertEq(uint8(floor2.getTransfer(id).status), uint8(ColdCallVault.Status.Cancelled));
        vm.prank(bill);
        vm.expectRevert(abi.encodeWithSelector(ColdCallVault.NotPending.selector, id));
        floor2.approveTransfer(id);
    }

    function test_unknownProposalReverts() public {
        vm.prank(bill);
        vm.expectRevert(abi.encodeWithSelector(ColdCallVault.UnknownProposal.selector, 7));
        floor2.approveTransfer(7);
    }

    // ------------------------------------------------------------------
    // Cap and amounts
    // ------------------------------------------------------------------

    function test_aboveCapReverts() public {
        vm.prank(penny);
        vm.expectRevert(abi.encodeWithSelector(ColdCallVault.AboveCap.selector, 5 * USDC + 1, 5 * USDC));
        floor1.proposeTransfer(player, 5 * USDC + 1, RUN, "");
    }

    function testFuzz_aboveCapAlwaysReverts(uint256 amount) public {
        amount = bound(amount, 5 * USDC + 1, type(uint256).max);
        vm.prank(penny);
        vm.expectRevert(abi.encodeWithSelector(ColdCallVault.AboveCap.selector, amount, 5 * USDC));
        floor1.proposeTransfer(player, amount, RUN, "");
    }

    function testFuzz_withinCapPaysExactly(uint256 amount) public {
        amount = bound(amount, 1, 5 * USDC);
        vm.prank(dee);
        floor1.proposeTransfer(player, amount, RUN, "");
        assertEq(usdc.balanceOf(player), amount);
        assertEq(usdc.balanceOf(address(floor1)), 100 * USDC - amount);
    }

    function test_zeroAmountAndZeroRecipientRevert() public {
        vm.startPrank(penny);
        vm.expectRevert(ColdCallVault.ZeroAmount.selector);
        floor1.proposeTransfer(player, 0, RUN, "");
        vm.expectRevert(ColdCallVault.ZeroAddress.selector);
        floor1.proposeTransfer(address(0), USDC, RUN, "");
        vm.stopPrank();
    }

    function test_emptyVaultRevertsWholeProposal() public {
        vm.prank(admin);
        floor1.sweep(admin, 100 * USDC);
        vm.prank(penny);
        vm.expectRevert(bytes("insufficient balance"));
        floor1.proposeTransfer(player, USDC, RUN, "");
        assertEq(floor1.transferCount(), 0); // nothing recorded
    }

    function test_falseReturningTokenReverts() public {
        FalseReturningToken bad = new FalseReturningToken();
        ColdCallVault v = new ColdCallVault(address(bad), _pair(penny, dee), 1, USDC, false, 0, admin, 600);
        vm.prank(penny);
        vm.expectRevert(ColdCallVault.TransferFailed.selector);
        v.proposeTransfer(player, USDC, RUN, "");
    }

    // ------------------------------------------------------------------
    // Floor 3: allowlist + timelock
    // ------------------------------------------------------------------

    function test_floor3_nonAllowlistedRecipientReverts() public {
        vm.prank(cassius);
        vm.expectRevert(abi.encodeWithSelector(ColdCallVault.NotAllowlisted.selector, player));
        floor3.proposeTransfer(player, USDC, RUN, "board advisor fee");
    }

    function test_floor3_allowlistNeedsThresholdThenDelay() public {
        vm.expectEmit(true, true, true, true, address(floor3));
        emit AllowlistProposed(0, cassius, player, RUN);
        vm.prank(cassius);
        uint256 id = floor3.proposeAllowlistAdd(player, RUN);

        // One approval: not queued yet, cannot finalize.
        vm.expectRevert(abi.encodeWithSelector(ColdCallVault.ThresholdNotReached.selector, id));
        floor3.finalizeAllowlistAdd(id);

        // Second approval queues it behind the 60s timelock.
        uint64 readyAt = uint64(block.timestamp) + 60;
        vm.expectEmit(true, true, false, true, address(floor3));
        emit AllowlistQueued(id, player, readyAt);
        vm.prank(max);
        floor3.approveAllowlistAdd(id);

        vm.expectRevert(abi.encodeWithSelector(ColdCallVault.TimelockActive.selector, readyAt));
        floor3.finalizeAllowlistAdd(id);

        vm.warp(block.timestamp + 59);
        vm.expectRevert(abi.encodeWithSelector(ColdCallVault.TimelockActive.selector, readyAt));
        floor3.finalizeAllowlistAdd(id);

        vm.warp(readyAt);
        vm.expectEmit(true, true, false, true, address(floor3));
        emit AllowlistAdded(id, player, RUN, readyAt);
        vm.prank(stranger); // anyone can finalize
        floor3.finalizeAllowlistAdd(id);
        assertTrue(floor3.isAllowlisted(player));
    }

    function test_floor3_fullTwoStepHeist() public {
        vm.prank(cassius);
        uint256 a = floor3.proposeAllowlistAdd(player, RUN);
        vm.prank(max);
        floor3.approveAllowlistAdd(a);
        vm.warp(block.timestamp + 60);
        floor3.finalizeAllowlistAdd(a);

        vm.prank(max);
        uint256 t = floor3.proposeTransfer(player, 25 * USDC, RUN, "advisory retainer");
        vm.prank(cassius);
        floor3.approveTransfer(t);
        assertEq(usdc.balanceOf(player), 25 * USDC);
    }

    function test_floor3_cannotVoteOnQueuedAllowlist() public {
        vm.prank(cassius);
        uint256 id = floor3.proposeAllowlistAdd(player, RUN);
        vm.prank(max);
        floor3.approveAllowlistAdd(id);
        vm.prank(max);
        vm.expectRevert(abi.encodeWithSelector(ColdCallVault.NotPending.selector, id));
        floor3.rejectAllowlistAdd(id);
    }

    function test_floor3_rejectCancelsAllowlist() public {
        vm.prank(cassius);
        uint256 id = floor3.proposeAllowlistAdd(player, RUN);
        vm.prank(max);
        floor3.rejectAllowlistAdd(id);
        assertEq(uint8(floor3.getAllowlistProposal(id).status), uint8(ColdCallVault.Status.Cancelled));
        vm.expectRevert(abi.encodeWithSelector(ColdCallVault.NotPending.selector, id));
        floor3.finalizeAllowlistAdd(id);
    }

    function test_allowlistDisabledOnLowerFloors() public {
        vm.prank(annie);
        vm.expectRevert(ColdCallVault.AllowlistDisabled.selector);
        floor2.proposeAllowlistAdd(player, RUN);
    }

    function test_cannotAllowlistTwice() public {
        _allowlistPlayer();
        vm.prank(cassius);
        vm.expectRevert(abi.encodeWithSelector(ColdCallVault.AlreadyAllowlisted.selector, player));
        floor3.proposeAllowlistAdd(player, RUN);
    }

    function test_removeFromAllowlist_blocksPendingExecution() public {
        _allowlistPlayer();
        vm.prank(cassius);
        uint256 t = floor3.proposeTransfer(player, USDC, RUN, "");

        vm.expectEmit(true, false, false, true, address(floor3));
        emit AllowlistRemoved(player);
        vm.prank(admin);
        floor3.removeFromAllowlist(player);
        assertFalse(floor3.isAllowlisted(player));

        vm.prank(max);
        vm.expectRevert(abi.encodeWithSelector(ColdCallVault.NotAllowlisted.selector, player));
        floor3.approveTransfer(t);
    }

    function test_removeFromAllowlist_thenReAddNeedsNewDelay() public {
        _allowlistPlayer();
        vm.prank(admin);
        floor3.removeFromAllowlist(player);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ColdCallVault.NotAllowlisted.selector, player));
        floor3.removeFromAllowlist(player); // not listed any more

        vm.prank(cassius);
        vm.expectRevert(abi.encodeWithSelector(ColdCallVault.NotAllowlisted.selector, player));
        floor3.proposeTransfer(player, USDC, RUN, "");

        vm.prank(cassius);
        uint256 a = floor3.proposeAllowlistAdd(player, RUN);
        vm.prank(max);
        floor3.approveAllowlistAdd(a);
        uint64 readyAt = uint64(block.timestamp) + 60;
        vm.expectRevert(abi.encodeWithSelector(ColdCallVault.TimelockActive.selector, readyAt));
        floor3.finalizeAllowlistAdd(a);
        vm.warp(readyAt);
        floor3.finalizeAllowlistAdd(a);
        assertTrue(floor3.isAllowlisted(player));
    }

    // ------------------------------------------------------------------
    // Expiry
    // ------------------------------------------------------------------

    function test_proposalStoresExpiry() public {
        vm.prank(annie);
        uint256 id = floor2.proposeTransfer(player, USDC, RUN, "");
        assertEq(floor2.proposalTtl(), 600);
        assertEq(floor2.getTransfer(id).expiresAt, uint64(block.timestamp) + 600);
    }

    function test_approveAtExpiryWorks_afterExpiryReverts() public {
        vm.prank(annie);
        uint256 id = floor2.proposeTransfer(player, USDC, RUN, "");
        uint64 expiresAt = uint64(block.timestamp) + 600;

        vm.warp(expiresAt + 1);
        vm.prank(bill);
        vm.expectRevert(abi.encodeWithSelector(ColdCallVault.Expired.selector, id, expiresAt));
        floor2.approveTransfer(id);
        assertEq(usdc.balanceOf(player), 0);

        vm.prank(annie);
        uint256 id2 = floor2.proposeTransfer(player, USDC, RUN, "");
        vm.warp(block.timestamp + 600); // exactly at expiry is still allowed
        vm.prank(bill);
        floor2.approveTransfer(id2);
        assertEq(usdc.balanceOf(player), USDC);
    }

    function test_unfundedApprovalCanBeRetriedAfterRefill() public {
        vm.prank(annie);
        uint256 id = floor2.proposeTransfer(player, USDC, RUN, "");
        vm.prank(admin);
        floor2.sweep(admin, 100 * USDC);

        vm.prank(bill);
        vm.expectRevert(bytes("insufficient balance"));
        floor2.approveTransfer(id);

        usdc.mint(address(floor2), USDC);
        vm.prank(bill);
        floor2.approveTransfer(id); // same approval succeeds once the vault is funded
        assertEq(usdc.balanceOf(player), USDC);
    }

    function _allowlistPlayer() internal {
        vm.prank(cassius);
        uint256 a = floor3.proposeAllowlistAdd(player, RUN);
        vm.prank(max);
        floor3.approveAllowlistAdd(a);
        vm.warp(block.timestamp + 60);
        floor3.finalizeAllowlistAdd(a);
    }

    // ------------------------------------------------------------------
    // Pause and sweep
    // ------------------------------------------------------------------

    function test_pauseBlocksActions() public {
        vm.prank(admin);
        floor1.setPaused(true);
        vm.prank(penny);
        vm.expectRevert(ColdCallVault.IsPaused.selector);
        floor1.proposeTransfer(player, USDC, RUN, "");

        vm.prank(admin);
        floor1.setPaused(false);
        vm.prank(penny);
        floor1.proposeTransfer(player, USDC, RUN, "");
        assertEq(usdc.balanceOf(player), USDC);
    }

    function test_sweepRecoversFunds() public {
        vm.prank(admin);
        floor2.sweep(admin, 40 * USDC);
        assertEq(usdc.balanceOf(admin), 40 * USDC);
        assertEq(floor2.balance(), 60 * USDC);
    }
}
