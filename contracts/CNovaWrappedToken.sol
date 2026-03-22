// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CNovaWrappedToken is ERC20, Ownable {
    uint8 private _customDecimals;
    address public bridge;

    error OnlyBridge();
    error ZeroAddress();

    event BridgeUpdated(address indexed oldBridge, address indexed newBridge);

    modifier onlyBridge() {
        if (msg.sender != bridge) revert OnlyBridge();
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address initialOwner_
    ) ERC20(name_, symbol_) Ownable(initialOwner_) {
        _customDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _customDecimals;
    }

    function setBridge(address newBridge) external onlyOwner {
        if (newBridge == address(0)) revert ZeroAddress();
        emit BridgeUpdated(bridge, newBridge);
        bridge = newBridge;
    }

    function mint(address to, uint256 amount) external onlyBridge {
        _mint(to, amount);
    }

    function burnFromBridge(address from, uint256 amount) external onlyBridge {
        _burn(from, amount);
    }
}
