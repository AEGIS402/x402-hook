// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

interface IAegis402SwapRouter {
    function swapExactInput(
        PoolKey calldata key,
        bool zeroForOne,
        uint256 amountIn,
        uint160 sqrtPriceLimitX96,
        bytes calldata hookData
    ) external returns (BalanceDelta delta);
}

contract ForwardingSwapper {
    function forwardSwap(
        IAegis402SwapRouter router,
        PoolKey calldata key,
        bool zeroForOne,
        uint256 amountIn,
        uint160 sqrtPriceLimitX96,
        bytes calldata hookData
    ) external returns (BalanceDelta delta) {
        Currency inputCurrency = zeroForOne ? key.currency0 : key.currency1;
        IERC20Minimal(Currency.unwrap(inputCurrency)).approve(address(router), amountIn);
        return router.swapExactInput(key, zeroForOne, amountIn, sqrtPriceLimitX96, hookData);
    }
}
