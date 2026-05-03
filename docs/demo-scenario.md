# Demo Scenario

Run the demo on a Sepolia fork:

```sh
npm install
SEPOLIA_RPC_URL=... npx hardhat test
SEPOLIA_RPC_URL=... npx hardhat run scripts/demo-aegis402.ts --network hardhat
```

The script deploys mock input/payment tokens, deploys SafeHook and VulnerableHook at valid Uniswap v4 hook-permission addresses, initializes two official `PoolManager` pools, adds liquidity through the official Sepolia `PoolModifyLiquidityTest`, then performs swaps through `Aegis402SwapRouter`.

Expected output:

- SafeHook emits `PaymentReady` only for a valid guard-signed context.
- VulnerableHook also emits `PaymentReady`, but its callback can observe the payment in `InFlight` state before settlement, demonstrating the intentionally vulnerable callback/reentrancy surface.
