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

## Live Sepolia References

The live verified deployment is documented in [live-sepolia-deployment.md](live-sepolia-deployment.md).

Key verified contracts:

| Contract | Verified source |
| --- | --- |
| Aegis402SafeHook | https://sepolia.etherscan.io/address/0xc4680Ab74eB4a4F7379016aa7b6044380Ae4C0C0#code |
| Aegis402VulnerableHook | https://sepolia.etherscan.io/address/0x70fAA067bE47D8dc839088Dcfc6f9338c07c80C0#code |
| Aegis402SwapRouter | https://sepolia.etherscan.io/address/0x4DbDe978D7110728a8E248a18ce4D8Ee20E258E8#code |

Live demo transactions:

| Scenario | Transaction |
| --- | --- |
| Normal SafeHook x402 swap | https://sepolia.etherscan.io/tx/0x99c05216bbc402d2fcaa8eb6c9676941fd99175279d20c1a68e9bebab1dd0111 |
| Problematic VulnerableHook callback swap | https://sepolia.etherscan.io/tx/0x3cabb984726cc3ba4e4924d49eef377ce411d220f8de93424a6f54649c2cb32b |
