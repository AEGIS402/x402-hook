# Minimal AEGIS402 Hook Spec

This demo treats x402 as an offchain payment-request flow and keeps the onchain layer intentionally small.

The wallet builds a `MinimalPaymentContext` from a mocked x402 `402 Payment Required` response. A guard signer approves that context with EIP-712. The Uniswap v4 hook receives the context as `hookData` and checks that the swap is for the approved payer, pool, chain, payment asset, amount, and expiry.

The demo uses the official Sepolia Uniswap v4 `PoolManager` at `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543`. The custom router exists only to expose `msgSender()` to the hook for payer verification.

## Context Fields

- `paymentId`: replay-protection key.
- `payer`: wallet or agent paying for the x402 request.
- `merchant` and `payTo`: resource provider and receiver.
- `asset`, `amount`, `minOut`: payment token and minimum swap result.
- `validUntil`, `chainId`, `poolId`: scope and expiry.
- `riskApproved`, `guardSignature`: offchain guard approval.

## Hook Behavior

`Aegis402SafeHook` uses `beforeSwap` for fail-closed context validation and `afterSwap` for received-amount validation and `PaymentReady` emission.

`Aegis402VulnerableHook` keeps the same external shape but intentionally includes benchmark vulnerabilities for audit tooling.
