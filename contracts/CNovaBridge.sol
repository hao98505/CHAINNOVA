// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface IWrappedToken {
    function mint(address to, uint256 amount) external;
    function burnFromBridge(address from, uint256 amount) external;
}

contract CNovaBridge is Ownable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    address public validator;
    uint256 public flatFeeWei;
    uint256 public nonce;

    struct TokenRoute {
        address remoteToken;
        bool wrapped;
        bool active;
    }

    mapping(address => TokenRoute) public tokenRoutes;
    mapping(bytes32 => bool) public processedTransfers;

    event TokenRouteConfigured(
        address indexed localToken,
        address indexed remoteToken,
        bool wrapped
    );
    event BridgeTransferInitiated(
        bytes32 indexed transferId,
        address indexed sender,
        address localToken,
        uint256 amount,
        uint256 targetChainId,
        bytes32 recipientBytes32
    );
    event BridgeTransferCompleted(
        bytes32 indexed transferId,
        address indexed recipient,
        address localToken,
        uint256 amount
    );
    event ValidatorUpdated(address indexed oldValidator, address indexed newValidator);
    event FlatFeeUpdated(uint256 oldFee, uint256 newFee);

    error InvalidValidator();
    error InsufficientFee();
    error RouteNotActive();
    error TransferAlreadyProcessed();
    error InvalidSignature();
    error ZeroAmount();

    constructor(
        address initialOwner,
        address initialValidator,
        uint256 initialFlatFeeWei
    ) Ownable(initialOwner) {
        validator = initialValidator;
        flatFeeWei = initialFlatFeeWei;
    }

    function setValidator(address newValidator) external onlyOwner {
        if (newValidator == address(0)) revert InvalidValidator();
        emit ValidatorUpdated(validator, newValidator);
        validator = newValidator;
    }

    function setFlatFee(uint256 newFee) external onlyOwner {
        emit FlatFeeUpdated(flatFeeWei, newFee);
        flatFeeWei = newFee;
    }

    function configureRoute(
        address localToken,
        address remoteToken,
        bool wrapped
    ) external onlyOwner {
        tokenRoutes[localToken] = TokenRoute({
            remoteToken: remoteToken,
            wrapped: wrapped,
            active: true
        });
        emit TokenRouteConfigured(localToken, remoteToken, wrapped);
    }

    function bridgeOut(
        address localToken,
        uint256 amount,
        uint256 targetChainId,
        bytes32 recipientBytes32
    ) external payable returns (bytes32 transferId) {
        if (amount == 0) revert ZeroAmount();
        if (msg.value < flatFeeWei) revert InsufficientFee();

        TokenRoute memory route = tokenRoutes[localToken];
        if (!route.active) revert RouteNotActive();

        transferId = keccak256(
            abi.encodePacked(
                block.chainid,
                msg.sender,
                localToken,
                amount,
                targetChainId,
                recipientBytes32,
                nonce++
            )
        );

        if (route.wrapped) {
            IWrappedToken(localToken).burnFromBridge(msg.sender, amount);
        } else {
            IERC20(localToken).safeTransferFrom(msg.sender, address(this), amount);
        }

        emit BridgeTransferInitiated(
            transferId,
            msg.sender,
            localToken,
            amount,
            targetChainId,
            recipientBytes32
        );
    }

    function completeTransfer(
        bytes calldata message,
        bytes calldata validatorSignature
    ) external {
        (
            bytes32 transferId,
            address localToken,
            uint256 amount,
            address recipient
        ) = abi.decode(message, (bytes32, address, uint256, address));

        if (processedTransfers[transferId]) revert TransferAlreadyProcessed();

        bytes32 messageHash = keccak256(message);
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(validatorSignature);

        if (signer != validator) revert InvalidSignature();

        processedTransfers[transferId] = true;

        TokenRoute memory route = tokenRoutes[localToken];
        if (!route.active) revert RouteNotActive();

        if (route.wrapped) {
            IWrappedToken(localToken).mint(recipient, amount);
        } else {
            IERC20(localToken).safeTransfer(recipient, amount);
        }

        emit BridgeTransferCompleted(transferId, recipient, localToken, amount);
    }

    function withdrawFees(address payable to) external onlyOwner {
        (bool success, ) = to.call{value: address(this).balance}("");
        require(success, "Fee withdrawal failed");
    }

    receive() external payable {}
}
