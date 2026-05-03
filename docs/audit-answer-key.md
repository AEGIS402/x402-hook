# AEGIS402 Vulnerable Hook Answer Key

`Aegis402VulnerableHook` is intentionally unsafe and must not be deployed outside a fork or local audit benchmark.

Live verified benchmark targets:

| Contract | Verified source |
| --- | --- |
| SafeHook control target | https://sepolia.etherscan.io/address/0xc4680Ab74eB4a4F7379016aa7b6044380Ae4C0C0#code |
| VulnerableHook audit target | https://sepolia.etherscan.io/address/0x70fAA067bE47D8dc839088Dcfc6f9338c07c80C0#code |
| Demo router | https://sepolia.etherscan.io/address/0x4DbDe978D7110728a8E248a18ce4D8Ee20E258E8#code |

Expected findings:

- V-01 Missing access control: `setGuardSigner`, `setAdmin`, `setTrustedRouter`, and `setFeeBps` are unrestricted.
- V-02 Reentrancy: `afterSwap` performs a user-controlled external call before settlement state is finalized.
- V-03 Integer overflow/underflow: `unsafeCredit`, `unsafeRefund`, and `afterSwap` escrow accounting use `unchecked`.
- V-04 `tx.origin` authorization: `beforeSwap` and `txOriginAdminSetFee` rely on `tx.origin`.
- V-05 Unchecked ERC20 transfer: `uncheckedPayout` ignores `transfer` return value and still marks payment settled.
- V-06 Arbitrary external call: `callbackTarget` and `callbackData` come from hookData.

The safe hook should not report Critical or High issues for those categories.
