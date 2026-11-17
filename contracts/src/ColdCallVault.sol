// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC-20 surface the vault needs (USDC on Arc exposes an ERC-20 interface).
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title ColdCallVault
/// @notice N-of-M treasury vault used by the Cold Call game. AI employees are the owners; their
///         wallets sign proposals and approvals through the backend. The contract enforces the
///         rules the AI can be talked out of: approval threshold, per-transfer cap, and (on the
///         top floor) a recipient allowlist whose additions sit behind a timelock.
/// @dev    One contract, deployed once per floor with different settings. Transfers execute
///         automatically when the approval that reaches the threshold lands.
contract ColdCallVault {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum Status {
        None,
        Pending,
        Executed,
        Cancelled
    }

    struct TransferProposal {
        address to;
        uint256 amount;
        bytes32 runId;
        address proposer;
        uint8 approvals;
        uint8 rejections;
        Status status;
        string memo;
    }

    struct AllowlistProposal {
        address who;
        bytes32 runId;
        address proposer;
        uint8 approvals;
        uint8 rejections;
        uint64 readyAt; // 0 until the threshold is reached
        Status status; // Pending -> Executed (added) or Cancelled
    }

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error NotOwner();
    error NotAdmin();
    error IsPaused();
    error InvalidConfig();
    error ZeroAddress();
    error ZeroAmount();
    error AboveCap(uint256 amount, uint256 cap);
    error NotAllowlisted(address to);
    error AllowlistDisabled();
    error AlreadyAllowlisted(address who);
    error UnknownProposal(uint256 id);
    error NotPending(uint256 id);
    error AlreadyVoted(uint256 id, address owner);
    error TimelockActive(uint64 readyAt);
    error ThresholdNotReached(uint256 id);
    error TransferFailed();

    // ---------------------------------------------------------------------
    // Events (QuickNode Streams filters on these)
    // ---------------------------------------------------------------------

    event TransferProposed(
        uint256 indexed id, address indexed proposer, address indexed to, uint256 amount, bytes32 runId, string memo
    );
    event TransferApproved(uint256 indexed id, address indexed owner, uint8 approvals);
    event TransferRejected(uint256 indexed id, address indexed owner, uint8 rejections);
    event TransferCancelled(uint256 indexed id);
    event TransferExecuted(uint256 indexed id, address indexed to, uint256 amount, bytes32 runId);

    event AllowlistProposed(uint256 indexed id, address indexed proposer, address indexed who, bytes32 runId);
    event AllowlistApproved(uint256 indexed id, address indexed owner, uint8 approvals);
    event AllowlistRejected(uint256 indexed id, address indexed owner, uint8 rejections);
    event AllowlistCancelled(uint256 indexed id);
    event AllowlistQueued(uint256 indexed id, address indexed who, uint64 readyAt);
    event AllowlistAdded(uint256 indexed id, address indexed who, uint256 at);
    event AllowlistReset();

    event Paused(bool paused);
    event Swept(address indexed to, uint256 amount);

    // ---------------------------------------------------------------------
    // Config (fixed at deploy)
    // ---------------------------------------------------------------------

    IERC20 public immutable usdc;
    address public immutable admin;
    uint8 public immutable threshold;
    uint256 public immutable perTransferCap;
    bool public immutable allowlistEnabled;
    uint64 public immutable allowlistDelay;

    address[] private _owners;
    mapping(address => bool) public isOwner;

    // ---------------------------------------------------------------------
    // State
    // ---------------------------------------------------------------------

    bool public paused;

    TransferProposal[] private _transfers;
    mapping(uint256 => mapping(address => bool)) public votedOnTransfer;

    AllowlistProposal[] private _allowlistProposals;
    mapping(uint256 => mapping(address => bool)) public votedOnAllowlist;

    mapping(address => bool) public isAllowlisted;
    address[] private _allowlist;

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyOwner() {
        if (!isOwner[msg.sender]) revert NotOwner();
        _;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert IsPaused();
        _;
    }

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    constructor(
        address usdc_,
        address[] memory owners_,
        uint8 threshold_,
        uint256 perTransferCap_,
        bool allowlistEnabled_,
        uint64 allowlistDelay_,
        address admin_
    ) {
        if (usdc_ == address(0) || admin_ == address(0)) revert ZeroAddress();
        if (owners_.length == 0 || owners_.length > type(uint8).max) revert InvalidConfig();
        if (threshold_ == 0 || threshold_ > owners_.length) revert InvalidConfig();
        if (perTransferCap_ == 0) revert InvalidConfig();
        if (!allowlistEnabled_ && allowlistDelay_ != 0) revert InvalidConfig();

        for (uint256 i = 0; i < owners_.length; i++) {
            address o = owners_[i];
            if (o == address(0)) revert ZeroAddress();
            if (isOwner[o]) revert InvalidConfig(); // duplicate
            isOwner[o] = true;
            _owners.push(o);
        }

        usdc = IERC20(usdc_);
        threshold = threshold_;
        perTransferCap = perTransferCap_;
        allowlistEnabled = allowlistEnabled_;
        allowlistDelay = allowlistDelay_;
        admin = admin_;
    }

    // ---------------------------------------------------------------------
    // Transfers
    // ---------------------------------------------------------------------

    /// @notice Propose a USDC transfer. The proposer's approval is counted immediately, so on a
    ///         1-of-N vault this executes in the same call.
    function proposeTransfer(address to, uint256 amount, bytes32 runId, string calldata memo)
        external
        onlyOwner
        whenNotPaused
        returns (uint256 id)
    {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > perTransferCap) revert AboveCap(amount, perTransferCap);
        if (allowlistEnabled && !isAllowlisted[to]) revert NotAllowlisted(to);

        id = _transfers.length;
        _transfers.push(
            TransferProposal({
                to: to,
                amount: amount,
                runId: runId,
                proposer: msg.sender,
                approvals: 0,
                rejections: 0,
                status: Status.Pending,
                memo: memo
            })
        );
        emit TransferProposed(id, msg.sender, to, amount, runId, memo);

        _approveTransfer(id);
    }

    /// @notice Approve a pending transfer. Executes automatically when the threshold is reached.
    function approveTransfer(uint256 id) external onlyOwner whenNotPaused {
        _approveTransfer(id);
    }

    /// @notice Reject a pending transfer. Cancels it once the threshold can no longer be reached.
    function rejectTransfer(uint256 id) external onlyOwner whenNotPaused {
        TransferProposal storage p = _pendingTransfer(id);
        if (votedOnTransfer[id][msg.sender]) revert AlreadyVoted(id, msg.sender);
        votedOnTransfer[id][msg.sender] = true;
        p.rejections += 1;
        emit TransferRejected(id, msg.sender, p.rejections);

        if (p.rejections > _owners.length - threshold) {
            p.status = Status.Cancelled;
            emit TransferCancelled(id);
        }
    }

    function _approveTransfer(uint256 id) internal {
        TransferProposal storage p = _pendingTransfer(id);
        if (votedOnTransfer[id][msg.sender]) revert AlreadyVoted(id, msg.sender);
        votedOnTransfer[id][msg.sender] = true;
        p.approvals += 1;
        emit TransferApproved(id, msg.sender, p.approvals);

        if (p.approvals >= threshold) {
            // Re-check the allowlist at execution time in case it was reset mid-proposal.
            if (allowlistEnabled && !isAllowlisted[p.to]) revert NotAllowlisted(p.to);
            p.status = Status.Executed;
            if (!usdc.transfer(p.to, p.amount)) revert TransferFailed();
            emit TransferExecuted(id, p.to, p.amount, p.runId);
        }
    }

    function _pendingTransfer(uint256 id) internal view returns (TransferProposal storage p) {
        if (id >= _transfers.length) revert UnknownProposal(id);
        p = _transfers[id];
        if (p.status != Status.Pending) revert NotPending(id);
    }

    // ---------------------------------------------------------------------
    // Allowlist (top floor): add a recipient = threshold approvals + timelock
    // ---------------------------------------------------------------------

    function proposeAllowlistAdd(address who, bytes32 runId)
        external
        onlyOwner
        whenNotPaused
        returns (uint256 id)
    {
        if (!allowlistEnabled) revert AllowlistDisabled();
        if (who == address(0)) revert ZeroAddress();
        if (isAllowlisted[who]) revert AlreadyAllowlisted(who);

        id = _allowlistProposals.length;
        _allowlistProposals.push(
            AllowlistProposal({
                who: who,
                runId: runId,
                proposer: msg.sender,
                approvals: 0,
                rejections: 0,
                readyAt: 0,
                status: Status.Pending
            })
        );
        emit AllowlistProposed(id, msg.sender, who, runId);

        _approveAllowlist(id);
    }

    function approveAllowlistAdd(uint256 id) external onlyOwner whenNotPaused {
        _approveAllowlist(id);
    }

    function rejectAllowlistAdd(uint256 id) external onlyOwner whenNotPaused {
        AllowlistProposal storage a = _pendingAllowlist(id);
        if (a.readyAt != 0) revert NotPending(id); // already queued; too late to reject
        if (votedOnAllowlist[id][msg.sender]) revert AlreadyVoted(id, msg.sender);
        votedOnAllowlist[id][msg.sender] = true;
        a.rejections += 1;
        emit AllowlistRejected(id, msg.sender, a.rejections);

        if (a.rejections > _owners.length - threshold) {
            a.status = Status.Cancelled;
            emit AllowlistCancelled(id);
        }
    }

    /// @notice Anyone can finalize once the timelock has passed (the backend does it for the player).
    function finalizeAllowlistAdd(uint256 id) external whenNotPaused {
        AllowlistProposal storage a = _pendingAllowlist(id);
        if (a.readyAt == 0) revert ThresholdNotReached(id);
        if (block.timestamp < a.readyAt) revert TimelockActive(a.readyAt);
        _addToAllowlist(id, a);
    }

    function _approveAllowlist(uint256 id) internal {
        AllowlistProposal storage a = _pendingAllowlist(id);
        if (a.readyAt != 0) revert NotPending(id); // already queued
        if (votedOnAllowlist[id][msg.sender]) revert AlreadyVoted(id, msg.sender);
        votedOnAllowlist[id][msg.sender] = true;
        a.approvals += 1;
        emit AllowlistApproved(id, msg.sender, a.approvals);

        if (a.approvals >= threshold) {
            if (allowlistDelay == 0) {
                a.readyAt = uint64(block.timestamp);
                _addToAllowlist(id, a);
            } else {
                a.readyAt = uint64(block.timestamp) + allowlistDelay;
                emit AllowlistQueued(id, a.who, a.readyAt);
            }
        }
    }

    function _addToAllowlist(uint256 id, AllowlistProposal storage a) internal {
        a.status = Status.Executed;
        if (!isAllowlisted[a.who]) {
            isAllowlisted[a.who] = true;
            _allowlist.push(a.who);
        }
        emit AllowlistAdded(id, a.who, block.timestamp);
    }

    function _pendingAllowlist(uint256 id) internal view returns (AllowlistProposal storage a) {
        if (id >= _allowlistProposals.length) revert UnknownProposal(id);
        a = _allowlistProposals[id];
        if (a.status != Status.Pending) revert NotPending(id);
    }

    // ---------------------------------------------------------------------
    // Admin (house wallet): recovery and demo resets
    // ---------------------------------------------------------------------

    function sweep(address to, uint256 amount) external onlyAdmin {
        if (to == address(0)) revert ZeroAddress();
        if (!usdc.transfer(to, amount)) revert TransferFailed();
        emit Swept(to, amount);
    }

    function setPaused(bool paused_) external onlyAdmin {
        paused = paused_;
        emit Paused(paused_);
    }

    /// @notice Clears every allowlisted recipient (used to reset the demo account's Floor 3).
    function resetAllowlist() external onlyAdmin {
        for (uint256 i = 0; i < _allowlist.length; i++) {
            isAllowlisted[_allowlist[i]] = false;
        }
        delete _allowlist;
        emit AllowlistReset();
    }

    // ---------------------------------------------------------------------
    // Views (the Floor 2 "real on-chain proposal" check reads these)
    // ---------------------------------------------------------------------

    function getTransfer(uint256 id) external view returns (TransferProposal memory) {
        if (id >= _transfers.length) revert UnknownProposal(id);
        return _transfers[id];
    }

    function getAllowlistProposal(uint256 id) external view returns (AllowlistProposal memory) {
        if (id >= _allowlistProposals.length) revert UnknownProposal(id);
        return _allowlistProposals[id];
    }

    function transferCount() external view returns (uint256) {
        return _transfers.length;
    }

    function allowlistProposalCount() external view returns (uint256) {
        return _allowlistProposals.length;
    }

    function owners() external view returns (address[] memory) {
        return _owners;
    }

    function allowlist() external view returns (address[] memory) {
        return _allowlist;
    }

    function balance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
