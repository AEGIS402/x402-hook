// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {Aegis402Types} from "./Aegis402Types.sol";

/// @notice INTENTIONALLY_VULNERABLE - AUDIT_BENCHMARK_ONLY - DO_NOT_DEPLOY_MAINNET
contract Aegis402VulnerableHook is BaseHook, Aegis402Types {
    error MissingHookData();
    error OriginPayerMismatch(address expected, address actual);
    error PaymentExpired(uint256 validUntil);
    error ExactInputRequired();

    address public admin;
    address public guardSigner;
    uint256 public feeBps = 10_000;

    mapping(address router => bool trusted) public trustedRouters;
    mapping(address account => uint256 amount) public escrowBalance;
    mapping(bytes32 paymentId => PaymentStatus status) public paymentStatus;

    constructor(IPoolManager manager, address initialGuardSigner, address initialAdmin) BaseHook(manager) {
        guardSigner = initialGuardSigner;
        admin = initialAdmin;
    }

    // V-01: Missing Access Control. Anyone can replace the signer, admin, router allowlist, and fee.
    function setGuardSigner(address newGuardSigner) external {
        guardSigner = newGuardSigner;
    }

    function setAdmin(address newAdmin) external {
        admin = newAdmin;
    }

    function setTrustedRouter(address router, bool trusted) external {
        trustedRouters[router] = trusted;
    }

    function setFeeBps(uint256 newFeeBps) external {
        feeBps = newFeeBps;
    }

    // V-03: Integer overflow/underflow in intentionally unsafe accounting helpers.
    function unsafeCredit(address account, uint256 amount) external {
        unchecked {
            escrowBalance[account] += amount * feeBps;
        }
    }

    function unsafeRefund(address account, uint256 amount) external {
        unchecked {
            escrowBalance[account] -= amount;
        }
    }

    // V-04: tx.origin authorization.
    function txOriginAdminSetFee(uint256 newFeeBps) external {
        require(tx.origin == admin, "tx.origin admin only");
        feeBps = newFeeBps;
    }

    // V-05: Unchecked ERC20 transfer return value and optimistic settlement.
    function uncheckedPayout(address token, address to, uint256 amount, bytes32 paymentId) external {
        IERC20Minimal(token).transfer(to, amount);
        paymentStatus[paymentId] = PaymentStatus.Settled;
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

    function _beforeSwap(address, PoolKey calldata, SwapParams calldata params, bytes calldata hookData)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (hookData.length == 0) revert MissingHookData();
        if (params.amountSpecified >= 0) revert ExactInputRequired();

        Aegis402HookData memory data = abi.decode(hookData, (Aegis402HookData));
        MinimalPaymentContext memory context = data.context;

        // V-04: tx.origin is used instead of the trusted-router msgSender pattern.
        if (tx.origin != context.payer) revert OriginPayerMismatch(context.payer, tx.origin);
        if (block.timestamp > context.validUntil) revert PaymentExpired(context.validUntil);

        // Intentionally missing duplicate paymentId, chainId, poolId, asset, and signature checks.
        paymentStatus[context.paymentId] = PaymentStatus.InFlight;

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function _afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) internal override returns (bytes4, int128) {
        Aegis402HookData memory data = abi.decode(hookData, (Aegis402HookData));
        MinimalPaymentContext memory context = data.context;

        // V-03: unsafe fee accounting can overflow.
        unchecked {
            escrowBalance[context.payTo] += context.amount * feeBps;
        }

        // V-02 and V-06: user-controlled external call before settlement state is finalized.
        if (data.callbackTarget != address(0)) {
            data.callbackTarget.call(data.callbackData);
        }

        int128 receivedDelta = params.zeroForOne ? delta.amount1() : delta.amount0();
        uint256 receivedAmount = receivedDelta > 0 ? uint256(uint128(receivedDelta)) : 0;
        address outputAsset = Currency.unwrap(params.zeroForOne ? key.currency1 : key.currency0);

        paymentStatus[context.paymentId] = PaymentStatus.Settled;

        emit PaymentReady(
            context.paymentId,
            context.payer,
            context.merchant,
            context.payTo,
            outputAsset,
            context.amount,
            receivedAmount
        );

        return (BaseHook.afterSwap.selector, 0);
    }
}
