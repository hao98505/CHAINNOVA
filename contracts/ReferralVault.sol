// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract ReferralVault is Ownable, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("Claim(address recipient,uint256 amount,uint256 nonce,uint256 deadline)");

    address public signer;

    mapping(address => address) public referrerOf;
    mapping(address => uint256) public nonces;
    mapping(address => uint256) public claimed;

    uint256 public totalClaimed;

    event ReferrerBound(address indexed user, address indexed referrer);
    event Claimed(address indexed user, uint256 amount, uint256 nonce);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event Deposited(address indexed sender, uint256 amount);

    constructor(
        address _signer,
        address _owner
    ) Ownable(_owner) EIP712("ReferralVault", "1") {
        require(_signer != address(0), "RV: zero signer");
        signer = _signer;
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    function bindReferrer(address _referrer) external {
        require(_referrer != address(0), "RV: zero referrer");
        require(_referrer != msg.sender, "RV: self referral");
        require(referrerOf[msg.sender] == address(0), "RV: already bound");

        referrerOf[msg.sender] = _referrer;
        emit ReferrerBound(msg.sender, _referrer);
    }

    function claim(
        uint256 _amount,
        uint256 _nonce,
        uint256 _deadline,
        bytes calldata _sig
    ) external nonReentrant {
        require(block.timestamp <= _deadline, "RV: expired");
        require(_nonce == nonces[msg.sender], "RV: invalid nonce");
        require(_amount > 0, "RV: zero amount");

        bytes32 structHash = keccak256(
            abi.encode(CLAIM_TYPEHASH, msg.sender, _amount, _nonce, _deadline)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = digest.recover(_sig);
        require(recovered == signer, "RV: invalid signature");

        nonces[msg.sender]++;
        claimed[msg.sender] += _amount;
        totalClaimed += _amount;

        _safeTransferBNB(msg.sender, _amount);
        emit Claimed(msg.sender, _amount, _nonce);
    }

    function setSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "RV: zero signer");
        emit SignerUpdated(signer, _signer);
        signer = _signer;
    }

    function _safeTransferBNB(address to, uint256 amount) internal {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "RV: BNB transfer failed");
    }
}
