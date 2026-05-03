// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {Aegis402Types} from "./Aegis402Types.sol";

interface IAegis402MsgSender {
    function msgSender() external view returns (address);
}

contract Aegis402SafeHook is BaseHook, Aegis402Types, Ownable, Pausable, ReentrancyGuard {
    error MissingHookData();
    error CallbackNotAllowed();
    error UntrustedRouter(address router);
    error PayerMismatch(address expected, address actual);
    error PaymentAlreadyUsed(bytes32 paymentId);
    error PaymentNotInFlight(bytes32 paymentId);
    error PaymentExpired(uint256 validUntil);
    error ChainMismatch(uint256 expected, uint256 actual);
    error PoolMismatch(bytes32 expected, bytes32 actual);
    error AssetMismatch(address expected, address actual);
    error RiskNotApproved();
    error InvalidGuardSignature(address recovered);
    error ExactInputRequired();
    error InvalidReceivedAmount(int128 receivedAmount);
    error InsufficientReceived(uint256 receivedAmount, uint256 requiredAmount);

    address public guardSigner;
    mapping(address router => bool trusted) public trustedRouters;
    mapping(bytes32 paymentId => PaymentStatus status) public paymentStatus;

    constructor(IPoolManager manager, address initialGuardSigner, address initialOwner)
        BaseHook(manager)
        Ownable(initialOwner)
    {
        guardSigner = initialGuardSigner;
    }

    function setGuardSigner(address newGuardSigner) external onlyOwner {
        guardSigner = newGuardSigner;
    }

    function setTrustedRouter(address router, bool trusted) external onlyOwner {
        trustedRouters[router] = trusted;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function _beforeSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        internal
        override
        whenNotPaused
        nonReentrant
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (hookData.length == 0) revert MissingHookData();
        if (params.amountSpecified >= 0) revert ExactInputRequired();

        Aegis402HookData memory data = abi.decode(hookData, (Aegis402HookData));
        MinimalPaymentContext memory context = data.context;

        if (data.callbackTarget != address(0) || data.callbackData.length != 0) revert CallbackNotAllowed();

        address actualPayer = _resolvePayer(sender);
        if (actualPayer != context.payer) revert PayerMismatch(context.payer, actualPayer);

        _validateContext(key, params, context);

        if (paymentStatus[context.paymentId] != PaymentStatus.Unknown) {
            revert PaymentAlreadyUsed(context.paymentId);
        }
        paymentStatus[context.paymentId] = PaymentStatus.InFlight;

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function _afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) internal override whenNotPaused nonReentrant returns (bytes4, int128) {
        Aegis402HookData memory data = abi.decode(hookData, (Aegis402HookData));
        MinimalPaymentContext memory context = data.context;

        if (paymentStatus[context.paymentId] != PaymentStatus.InFlight) {
            revert PaymentNotInFlight(context.paymentId);
        }

        int128 receivedDelta = params.zeroForOne ? delta.amount1() : delta.amount0();
        if (receivedDelta <= 0) revert InvalidReceivedAmount(receivedDelta);

        uint256 receivedAmount = uint256(uint128(receivedDelta));
        if (receivedAmount < context.minOut) revert InsufficientReceived(receivedAmount, context.minOut);
        if (receivedAmount < context.amount) revert InsufficientReceived(receivedAmount, context.amount);

        address outputAsset = _outputAsset(key, params);
        if (outputAsset != context.asset) revert AssetMismatch(context.asset, outputAsset);

        paymentStatus[context.paymentId] = PaymentStatus.Settled;

        emit PaymentReady(
            context.paymentId,
            context.payer,
            context.merchant,
            context.payTo,
            context.asset,
            context.amount,
            receivedAmount
        );

        return (BaseHook.afterSwap.selector, 0);
    }

    function _validateContext(PoolKey calldata key, SwapParams calldata params, MinimalPaymentContext memory context)
        internal
        view
    {
        if (block.timestamp > context.validUntil) revert PaymentExpired(context.validUntil);
        if (block.chainid != context.chainId) revert ChainMismatch(context.chainId, block.chainid);

        bytes32 actualPoolId = PoolId.unwrap(key.toId());
        if (actualPoolId != context.poolId) revert PoolMismatch(context.poolId, actualPoolId);

        address outputAsset = _outputAsset(key, params);
        if (outputAsset != context.asset) revert AssetMismatch(context.asset, outputAsset);

        if (!context.riskApproved) revert RiskNotApproved();

        address recovered = _recoverGuard(context);
        if (recovered != guardSigner) revert InvalidGuardSignature(recovered);
    }

    function _resolvePayer(address sender) internal view returns (address) {
        if (!trustedRouters[sender]) revert UntrustedRouter(sender);

        try IAegis402MsgSender(sender).msgSender() returns (address payer) {
            return payer;
        } catch {
            revert UntrustedRouter(sender);
        }
    }

    function _outputAsset(PoolKey calldata key, SwapParams calldata params) internal pure returns (address) {
        Currency outputCurrency = params.zeroForOne ? key.currency1 : key.currency0;
        return Currency.unwrap(outputCurrency);
    }
}
