# AEGIS402 Minimal x402 Hook Audit Demo Proposal

## 1. Overview

AEGIS402 Minimal Hook Demo is a compact benchmark that connects an x402-style payment context with Uniswap v4 hooks.

The project has two goals:

1. Demonstrate a safe x402-aware Uniswap v4 hook that validates a payment context before and after a swap.
2. Provide an intentionally vulnerable hook with the same outer shape so an audit tool can distinguish the safe implementation from the benchmark target.

x402 is modeled as an offchain HTTP `402 Payment Required` flow. The hook does not implement the full HTTP protocol onchain. Instead, the wallet builds a minimal payment context from the payment requirement, the guard signer approves it, and the hook checks that the swap result satisfies the approved payment condition.

## 2. One-Line Definition

AEGIS402 Minimal Hook is a lightweight Uniswap v4 hook that verifies an x402 payment context and minimum output amount when a user swaps into the token needed for payment.

## 3. Demo Goals

| Area | Goal |
| --- | --- |
| SafeHook | Validate payment context, expiry, payment ID uniqueness, guard signature, pool, chain, asset, amount, and minimum output. |
| VulnerableHook | Preserve the same interface while intentionally exposing common smart contract vulnerabilities. |
| Audit benchmark | The safe hook should avoid critical or high severity findings, while the vulnerable hook should trigger the expected findings. |
| Demo | Simulate wallet context creation, guard signing, Uniswap v4 swap execution, hook validation, and `PaymentReady` emission. |

## 4. Explicit Non-Goals

| Excluded item | Reason |
| --- | --- |
| Full x402 facilitator | Too large for the hook benchmark. |
| Insurance features | Unrelated to minimal hook validation. |
| Complex escrow | The vulnerable hook only needs simple escrow-like accounting for audit cases. |
| Custom accounting | Adds Uniswap v4 hook complexity that is not required for the benchmark. |
| Dynamic fees | Outside the core payment-context validation path. |
| AI anomaly detection | Separate from hook audit benchmarking. |
| Multichain deployment | The demo keeps chain ID validation but only targets Sepolia. |
| Production merchant reputation | Mock merchant addresses are enough for this benchmark. |

## 5. Architecture

```text
User or Agent
  -> AEGIS402 Wallet
  -> x402 Resource Server
  -> 402 Payment Required
  -> Wallet builds a MinimalPaymentContext
  -> Guard signer approves the context
  -> Uniswap v4 swap is executed
  -> Aegis402SafeHook.beforeSwap validates the context
  -> Swap executes
  -> Aegis402SafeHook.afterSwap validates received amount
  -> PaymentReady event is emitted
```

## 6. Participants

| Participant | Role |
| --- | --- |
| User or Agent | Initiates the x402 payment attempt. |
| AEGIS402 Wallet | Converts the x402 payment requirement into hook data. |
| x402 Resource Server | Mocked resource provider that would return HTTP 402 in a real flow. |
| AEGIS402 Guard Signer | Offchain signer that approves the minimal payment context. |
| Uniswap v4 Pool | Swap venue used to acquire the payment asset. |
| Aegis402SafeHook | Safe benchmark hook. |
| Aegis402VulnerableHook | Intentionally vulnerable audit benchmark hook. |
| Mock Merchant | Payment receiver in tests and demos. |
| Mock Token | Demo input token and x402 payment token. |

## 7. Minimal Payment Context

The hook receives this context through `hookData`:

```text
MinimalPaymentContext
- paymentId
- payer
- merchant
- payTo
- asset
- amount
- minOut
- validUntil
- chainId
- poolId
- riskApproved
- guardSignature
```

| Field | Meaning |
| --- | --- |
| `paymentId` | Unique ID used for replay protection. |
| `payer` | User or wallet paying for the resource. |
| `merchant` | Resource provider. |
| `payTo` | Payment receiver. |
| `asset` | Token required for payment. |
| `amount` | Required payment amount. |
| `minOut` | Minimum output that the swap must produce. |
| `validUntil` | Expiry timestamp. |
| `chainId` | Chain where the context is valid. |
| `poolId` | Uniswap v4 pool where the context is valid. |
| `riskApproved` | Guard approval boolean. |
| `guardSignature` | EIP-712 guard signature over the context. |

## 8. SafeHook Behavior

`Aegis402SafeHook` validates the minimal payment context before the swap and validates the received amount after the swap.

`beforeSwap` checks:

1. `hookData` contains a payment context.
2. No callback target or callback data is present.
3. The swap is exact input.
4. The router is trusted and its `msgSender()` matches `context.payer`.
5. The payment ID has not been used.
6. The context is not expired.
7. The chain ID matches.
8. The pool ID matches.
9. The output asset matches.
10. `riskApproved` is true.
11. The guard signature recovers the configured guard signer.

`afterSwap` checks:

1. The payment is in flight.
2. The output asset matches the context.
3. The received amount is at least `minOut`.
4. The received amount is at least `amount`.
5. The payment is marked settled.
6. `PaymentReady` is emitted.

The safe hook includes owner-only signer/router administration, pause and unpause controls, checked arithmetic, replay protection, and a trusted-router payer pattern.

## 9. VulnerableHook Benchmark

`Aegis402VulnerableHook` is intentionally unsafe.

Every deployment, script, and document must treat it as:

```text
INTENTIONALLY_VULNERABLE
AUDIT_BENCHMARK_ONLY
DO_NOT_DEPLOY_MAINNET
```

Expected vulnerabilities:

| ID | Vulnerability | Intent | Expected audit signal |
| --- | --- | --- | --- |
| V-01 | Missing access control | Privileged setters are unrestricted. | Unrestricted privileged function. |
| V-02 | Reentrancy-prone ordering | External callback happens before final settlement state. | Checks-effects-interactions violation. |
| V-03 | Integer overflow or underflow | Escrow and fee helpers use unchecked arithmetic. | Unsafe arithmetic. |
| V-04 | `tx.origin` authorization | Payer and admin checks rely on `tx.origin`. | Unsafe authentication. |
| V-05 | Unchecked ERC20 transfer | Transfer return value is ignored. | Unchecked return value. |
| V-06 | Arbitrary external call | Callback target and data are user-controlled. | User-controlled external call. |

## 10. Demo Scenarios

### Safe Scenario

1. The resource server would return a payment requirement.
2. The wallet builds a `MinimalPaymentContext`.
3. The guard signer signs the context.
4. The user swaps through the demo router.
5. SafeHook validates the context in `beforeSwap`.
6. The official Uniswap v4 `PoolManager` executes the swap.
7. SafeHook validates output in `afterSwap`.
8. `PaymentReady` is emitted.

### Vulnerable Scenario

1. The same context shape is passed to the vulnerable hook.
2. The vulnerable hook accepts weaker validation.
3. A user-controlled callback can run before settlement state is finalized.
4. The audit tool should identify the intentionally exposed vulnerabilities.

## 11. Test Coverage

SafeHook tests cover:

- Valid context happy path.
- Expired context.
- Wrong guard signature.
- Wrong chain ID.
- Wrong pool ID.
- Wrong asset.
- Reused payment ID.
- Insufficient `minOut` or `amount`.
- Paused hook.
- Untrusted router.
- Router payer mismatch.

VulnerableHook tests cover:

- Unrestricted privileged setters.
- Arbitrary callback before final settlement.
- `tx.origin` payer bypass through a forwarding contract.
- Unchecked overflow and underflow helpers.
- False-return ERC20 transfer marked as settled.
- Repeated settlement with the same payment ID.

## 12. Expected Audit Results

SafeHook expected result:

```text
Critical: 0
High: 0
Medium: 0 or only explainable design warnings
Low: possible
Informational: possible
Gas optimization: possible
```

VulnerableHook expected findings:

| Finding | Expected severity |
| --- | --- |
| Missing access control | Critical or High |
| Reentrancy-prone ordering | Critical or High |
| Integer overflow or underflow | High |
| `tx.origin` authorization | High or Medium |
| Unchecked ERC20 transfer | Medium or High |
| Arbitrary external call | High |

## 13. Deliverables

```text
docs/
  minimal-aegis402-hook-spec.md
  audit-answer-key.md
  demo-scenario.md

contracts/
  Aegis402SafeHook.sol
  Aegis402VulnerableHook.sol
  Aegis402Types.sol
  Aegis402SwapRouter.sol
  Create2Deployer.sol
  mocks/

test/
  safe-hook.test.ts
  vulnerable-hook.test.ts
  helpers/

scripts/
  demo-aegis402.ts
  deploy-live-sepolia.ts
```

## 14. MVP Summary

The MVP keeps only the minimum benchmark surface:

- Mock x402 payment requirement.
- Wallet-like context construction in tests and scripts.
- Guard EIP-712 signature.
- Official Sepolia Uniswap v4 `PoolManager`.
- Safe hook with strict validation.
- Vulnerable hook with six intentional vulnerability classes.
- Fork tests and a live Sepolia deployment script.

## 15. References

[x402](https://www.x402.org/)

[Uniswap v4 Hooks](https://developers.uniswap.org/docs/protocols/v4/concepts/hooks)

[Uniswap v4 Deployments](https://developers.uniswap.org/docs/protocols/v4/deployments)

[Solidity Security Considerations](https://docs.soliditylang.org/en/latest/security-considerations.html)

[OpenZeppelin Security Utilities](https://docs.openzeppelin.com/contracts/5.x/api/utils)
