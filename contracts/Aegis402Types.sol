// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

abstract contract Aegis402Types is EIP712 {
    enum PaymentStatus {
        Unknown,
        InFlight,
        Settled
    }

    struct MinimalPaymentContext {
        bytes32 paymentId;
        address payer;
        address merchant;
        address payTo;
        address asset;
        uint256 amount;
        uint256 minOut;
        uint256 validUntil;
        uint256 chainId;
        bytes32 poolId;
        bool riskApproved;
        bytes guardSignature;
    }

    struct Aegis402HookData {
        MinimalPaymentContext context;
        address callbackTarget;
        bytes callbackData;
    }

    bytes32 public constant PAYMENT_CONTEXT_TYPEHASH = keccak256(
        "MinimalPaymentContext(bytes32 paymentId,address payer,address merchant,address payTo,address asset,uint256 amount,uint256 minOut,uint256 validUntil,uint256 chainId,bytes32 poolId,bool riskApproved)"
    );

    event PaymentReady(
        bytes32 indexed paymentId,
        address indexed payer,
        address indexed merchant,
        address payTo,
        address asset,
        uint256 amount,
        uint256 receivedAmount
    );

    constructor() EIP712("AEGIS402Hook", "1") {}

    function _hashPaymentContext(MinimalPaymentContext memory context) internal view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    PAYMENT_CONTEXT_TYPEHASH,
                    context.paymentId,
                    context.payer,
                    context.merchant,
                    context.payTo,
                    context.asset,
                    context.amount,
                    context.minOut,
                    context.validUntil,
                    context.chainId,
                    context.poolId,
                    context.riskApproved
                )
            )
        );
    }

    function _recoverGuard(MinimalPaymentContext memory context) internal view returns (address) {
        return ECDSA.recover(_hashPaymentContext(context), context.guardSignature);
    }
}
