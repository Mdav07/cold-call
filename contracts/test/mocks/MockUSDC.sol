// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Minimal 6-decimal ERC-20 for tests. Reverts on insufficient balance like real USDC.
contract MockUSDC {
    string public constant name = "Mock USDC";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;

    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @dev A token that returns false instead of reverting, to test the TransferFailed path.
contract FalseReturningToken {
    mapping(address => uint256) public balanceOf;

    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }
}
