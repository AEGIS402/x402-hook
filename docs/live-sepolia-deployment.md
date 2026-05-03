# Live Sepolia Deployment

This document is the auditor-facing registry for the live Sepolia AEGIS402 x402 hook benchmark.

Deployment date: `2026-05-03T00:27:50.640Z`

Deployer: [`0x2f149CaA0e931e13f6F32bd3E46eFc6e96bcC36A`](https://sepolia.etherscan.io/address/0x2f149CaA0e931e13f6F32bd3E46eFc6e96bcC36A)

## Official Uniswap v4 Sepolia Contracts

| Contract | Address |
| --- | --- |
| PoolManager | [`0xE03A1074c86CFeDd5C142C4F04F1a1536e203543`](https://sepolia.etherscan.io/address/0xE03A1074c86CFeDd5C142C4F04F1a1536e203543) |
| PoolModifyLiquidityTest | [`0x0c478023803a644c94c4ce1c1e7b9a087e411b0a`](https://sepolia.etherscan.io/address/0x0c478023803a644c94c4ce1c1e7b9a087e411b0a) |
| StateView | [`0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c`](https://sepolia.etherscan.io/address/0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c) |
| Quoter | [`0x61b3f2011a92d183c7dbadbda940a7555ccf9227`](https://sepolia.etherscan.io/address/0x61b3f2011a92d183c7dbadbda940a7555ccf9227) |

## Verified Demo Contracts

| Contract | Role | Address | Verified source | Deployment transaction |
| --- | --- | --- | --- | --- |
| Input MockERC20 | Demo swap input token | [`0x7E18Bb46c48fa9af923f841BF050da2E8A215029`](https://sepolia.etherscan.io/address/0x7E18Bb46c48fa9af923f841BF050da2E8A215029) | [Code](https://sepolia.etherscan.io/address/0x7E18Bb46c48fa9af923f841BF050da2E8A215029#code) | [`0x367295647290323a03446ccf9f57ca03506e1e0dc1e7ac6683b0fd44be233079`](https://sepolia.etherscan.io/tx/0x367295647290323a03446ccf9f57ca03506e1e0dc1e7ac6683b0fd44be233079) |
| Payment MockERC20 | x402 payment asset | [`0xB517249EcCf1DcE96179bae820d5fA42124C6287`](https://sepolia.etherscan.io/address/0xB517249EcCf1DcE96179bae820d5fA42124C6287) | [Code](https://sepolia.etherscan.io/address/0xB517249EcCf1DcE96179bae820d5fA42124C6287#code) | [`0x4d66b1cf0794fb67c801bc61c8d478f770805bec0472f3d1c76fc319869da195`](https://sepolia.etherscan.io/tx/0x4d66b1cf0794fb67c801bc61c8d478f770805bec0472f3d1c76fc319869da195) |
| Create2Deployer | Hook-permission address deployer | [`0x57ac905b46054c0Cba68c71770ad849e63317051`](https://sepolia.etherscan.io/address/0x57ac905b46054c0Cba68c71770ad849e63317051) | [Code](https://sepolia.etherscan.io/address/0x57ac905b46054c0Cba68c71770ad849e63317051#code) | [`0xd138c513ec46153ba87c391c848db3af07e5c4d50e71b1b454a6afc9380ffe25`](https://sepolia.etherscan.io/tx/0xd138c513ec46153ba87c391c848db3af07e5c4d50e71b1b454a6afc9380ffe25) |
| Aegis402SafeHook | Safe x402-aware Uniswap v4 hook | [`0xc4680Ab74eB4a4F7379016aa7b6044380Ae4C0C0`](https://sepolia.etherscan.io/address/0xc4680Ab74eB4a4F7379016aa7b6044380Ae4C0C0) | [Code](https://sepolia.etherscan.io/address/0xc4680Ab74eB4a4F7379016aa7b6044380Ae4C0C0#code) | [`0x1eea6b4672d71d7b48dc7e491b28d934ea6f05a20a58b86095831d480ca08503`](https://sepolia.etherscan.io/tx/0x1eea6b4672d71d7b48dc7e491b28d934ea6f05a20a58b86095831d480ca08503) |
| Aegis402VulnerableHook | Intentionally vulnerable audit benchmark hook | [`0x70fAA067bE47D8dc839088Dcfc6f9338c07c80C0`](https://sepolia.etherscan.io/address/0x70fAA067bE47D8dc839088Dcfc6f9338c07c80C0) | [Code](https://sepolia.etherscan.io/address/0x70fAA067bE47D8dc839088Dcfc6f9338c07c80C0#code) | [`0x19d5bb54a1028f68b208a96f4007d060241480fb2d16f1bd6236a69cdc8ae612`](https://sepolia.etherscan.io/tx/0x19d5bb54a1028f68b208a96f4007d060241480fb2d16f1bd6236a69cdc8ae612) |
| Aegis402SwapRouter | Minimal router exposing `msgSender()` to hooks | [`0x4DbDe978D7110728a8E248a18ce4D8Ee20E258E8`](https://sepolia.etherscan.io/address/0x4DbDe978D7110728a8E248a18ce4D8Ee20E258E8) | [Code](https://sepolia.etherscan.io/address/0x4DbDe978D7110728a8E248a18ce4D8Ee20E258E8#code) | [`0x8657d1fe2f521ac0ee1783f774f171e38fd9fe4a4bc37b9ccb94e613a52dc5c3`](https://sepolia.etherscan.io/tx/0x8657d1fe2f521ac0ee1783f774f171e38fd9fe4a4bc37b9ccb94e613a52dc5c3) |
| MockMerchantReceiver | Callback observer for the vulnerable scenario | [`0xAd385F9c8640cEf405f6269B132d2bcb0fA8b58c`](https://sepolia.etherscan.io/address/0xAd385F9c8640cEf405f6269B132d2bcb0fA8b58c) | [Code](https://sepolia.etherscan.io/address/0xAd385F9c8640cEf405f6269B132d2bcb0fA8b58c#code) | [`0x17edd38ff333bd5275c2395ea21474b5da2299ce2ce0c3233cbf77bbf56be5dc`](https://sepolia.etherscan.io/tx/0x17edd38ff333bd5275c2395ea21474b5da2299ce2ce0c3233cbf77bbf56be5dc) |

## Hook Permission Check

Both hook addresses end in `0xC0`, which encodes the Uniswap v4 `beforeSwap` and `afterSwap` hook permissions used by this benchmark.

## Demo Transactions

| Scenario | Transaction | Expected result |
| --- | --- | --- |
| Normal SafeHook x402 swap | [`0x99c05216bbc402d2fcaa8eb6c9676941fd99175279d20c1a68e9bebab1dd0111`](https://sepolia.etherscan.io/tx/0x99c05216bbc402d2fcaa8eb6c9676941fd99175279d20c1a68e9bebab1dd0111) | Valid guard-signed context emits `PaymentReady`. |
| Problematic VulnerableHook callback swap | [`0x3cabb984726cc3ba4e4924d49eef377ce411d220f8de93424a6f54649c2cb32b`](https://sepolia.etherscan.io/tx/0x3cabb984726cc3ba4e4924d49eef377ce411d220f8de93424a6f54649c2cb32b) | User-controlled callback observes `InFlight` state before settlement. |

## Verification Command

```sh
npm run verify:sepolia
```

The verification script reads `ETHERSCAN_API_KEY` from `.env` and verifies the contracts listed above.
