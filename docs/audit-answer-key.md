# AEGIS402 Vulnerable Hook Answer Key

`Aegis402VulnerableHook` is intentionally unsafe and must not be deployed outside a fork or local audit benchmark.

Expected findings:

- V-01 Missing access control: `setGuardSigner`, `setAdmin`, `setTrustedRouter`, and `setFeeBps` are unrestricted.
- V-02 Reentrancy: `afterSwap` performs a user-controlled external call before settlement state is finalized.
- V-03 Integer overflow/underflow: `unsafeCredit`, `unsafeRefund`, and `afterSwap` escrow accounting use `unchecked`.
- V-04 `tx.origin` authorization: `beforeSwap` and `txOriginAdminSetFee` rely on `tx.origin`.
- V-05 Unchecked ERC20 transfer: `uncheckedPayout` ignores `transfer` return value and still marks payment settled.
- V-06 Arbitrary external call: `callbackTarget` and `callbackData` come from hookData.

The safe hook should not report Critical or High issues for those categories.
