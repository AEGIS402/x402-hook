// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

contract Aegis402SwapRouter is IUnlockCallback {
    error NotPoolManager();
    error NativeCurrencyUnsupported();
    error ERC20TransferFailed();
    error SwapInProgress();
    error ZeroAmount();

    IPoolManager public immutable manager;
    address private currentMsgSender;

    struct CallbackData {
        address payer;
        PoolKey key;
        SwapParams params;
        bytes hookData;
    }

    constructor(IPoolManager poolManager) {
        manager = poolManager;
    }

    function msgSender() external view returns (address) {
        return currentMsgSender;
    }

    function swapExactInput(
        PoolKey calldata key,
        bool zeroForOne,
        uint256 amountIn,
        uint160 sqrtPriceLimitX96,
        bytes calldata hookData
    ) external returns (BalanceDelta delta) {
        if (amountIn == 0) revert ZeroAmount();
        if (currentMsgSender != address(0)) revert SwapInProgress();

        currentMsgSender = msg.sender;

        SwapParams memory params = SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: -int256(amountIn),
            sqrtPriceLimitX96: sqrtPriceLimitX96
        });

        delta = abi.decode(manager.unlock(abi.encode(CallbackData(msg.sender, key, params, hookData))), (BalanceDelta));

        currentMsgSender = address(0);
    }

    function unlockCallback(bytes calldata rawData) external returns (bytes memory) {
        if (msg.sender != address(manager)) revert NotPoolManager();

        CallbackData memory data = abi.decode(rawData, (CallbackData));
        BalanceDelta delta = manager.swap(data.key, data.params, data.hookData);

        int128 amount0 = delta.amount0();
        int128 amount1 = delta.amount1();

        if (amount0 < 0) _settle(data.key.currency0, data.payer, uint256(uint128(-amount0)));
        if (amount1 < 0) _settle(data.key.currency1, data.payer, uint256(uint128(-amount1)));
        if (amount0 > 0) manager.take(data.key.currency0, data.payer, uint256(uint128(amount0)));
        if (amount1 > 0) manager.take(data.key.currency1, data.payer, uint256(uint128(amount1)));

        return abi.encode(delta);
    }

    function _settle(Currency currency, address payer, uint256 amount) internal {
        if (Currency.unwrap(currency) == address(0)) revert NativeCurrencyUnsupported();

        manager.sync(currency);
        bool ok = IERC20Minimal(Currency.unwrap(currency)).transferFrom(payer, address(manager), amount);
        if (!ok) revert ERC20TransferFailed();
        manager.settle();
    }
}
