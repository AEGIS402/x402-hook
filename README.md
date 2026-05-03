# AEGIS402 x402 Hook Audit Demo

This repository contains a minimal AEGIS402 x402-aware Uniswap v4 hook audit benchmark.

The live Sepolia deployment below uses the official Uniswap v4 Sepolia `PoolManager` and `PoolModifyLiquidityTest` contracts. The SafeHook demonstrates the expected payment-context validation path. The VulnerableHook intentionally keeps the same outer shape while exposing audit benchmark issues.

## Live Sepolia Deployment

Deployment date: 2026-05-03T00:27:50.640Z

Deployer: `0x2f149CaA0e931e13f6F32bd3E46eFc6e96bcC36A`

Deployer balance after deployment: `0.545138457932985409 Sepolia ETH`

Official Uniswap v4 Sepolia contracts:

| Contract | Address |
| --- | --- |
| PoolManager | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` |
| PoolModifyLiquidityTest | `0x0c478023803a644c94c4ce1c1e7b9a087e411b0a` |
| StateView | `0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c` |
| Quoter | `0x61b3f2011a92d183c7dbadbda940a7555ccf9227` |

Deployed demo contracts:

| Contract | Address |
| --- | --- |
| Input MockERC20 | `0x7E18Bb46c48fa9af923f841BF050da2E8A215029` |
| Payment MockERC20 | `0xB517249EcCf1DcE96179bae820d5fA42124C6287` |
| Create2Deployer | `0x57ac905b46054c0Cba68c71770ad849e63317051` |
| Aegis402SafeHook | `0xc4680Ab74eB4a4F7379016aa7b6044380Ae4C0C0` |
| Aegis402VulnerableHook | `0x70fAA067bE47D8dc839088Dcfc6f9338c07c80C0` |
| Aegis402SwapRouter | `0x4DbDe978D7110728a8E248a18ce4D8Ee20E258E8` |
| MockMerchantReceiver | `0xAd385F9c8640cEf405f6269B132d2bcb0fA8b58c` |

Pool identifiers:

| Pool | Pool ID |
| --- | --- |
| SafeHook pool | `0xf0a88bee828762d20fb6ca157434673272d8ba013ef69f5eb7fed4d79e247408` |
| VulnerableHook pool | `0x163c749f93f91b196f52455ca25c556d96336f2193fc0b5ab188e537c6fcb90c` |

Demo transactions:

| Scenario | Transaction Hash |
| --- | --- |
| Normal SafeHook x402 swap | `0x99c05216bbc402d2fcaa8eb6c9676941fd99175279d20c1a68e9bebab1dd0111` |
| Problematic VulnerableHook callback swap | `0x3cabb984726cc3ba4e4924d49eef377ce411d220f8de93424a6f54649c2cb32b` |

Payment identifiers:

| Scenario | Payment ID |
| --- | --- |
| Normal SafeHook x402 swap | `0x5b90c6c79b17864632f1c9551aa1d6c6f5428ae419c5737ac0b92782cd01d6fa` |
| Problematic VulnerableHook callback swap | `0x50b6a1a22a5af71572a48e5e2dc36823bc85f256c79203e4a14dd7aad02f0d80` |

All broadcast transactions:

| Step | Transaction Hash |
| --- | --- |
| Deploy MockERC20 | `0x367295647290323a03446ccf9f57ca03506e1e0dc1e7ac6683b0fd44be233079` |
| Deploy MockERC20 | `0x4d66b1cf0794fb67c801bc61c8d478f770805bec0472f3d1c76fc319869da195` |
| Deploy Create2Deployer | `0xd138c513ec46153ba87c391c848db3af07e5c4d50e71b1b454a6afc9380ffe25` |
| Deploy Aegis402SafeHook | `0x1eea6b4672d71d7b48dc7e491b28d934ea6f05a20a58b86095831d480ca08503` |
| Deploy Aegis402VulnerableHook | `0x19d5bb54a1028f68b208a96f4007d060241480fb2d16f1bd6236a69cdc8ae612` |
| Deploy Aegis402SwapRouter | `0x8657d1fe2f521ac0ee1783f774f171e38fd9fe4a4bc37b9ccb94e613a52dc5c3` |
| Deploy MockMerchantReceiver | `0x17edd38ff333bd5275c2395ea21474b5da2299ce2ce0c3233cbf77bbf56be5dc` |
| SafeHook set trusted router | `0xba1295628899bc988a74e1e24a5a40d4d805dd4a87a3e549c674d8eb5f925258` |
| Mint input token | `0x5e11f281a05d15b4305645256451787db77875d532c95be5cec1df2645176ec9` |
| Mint payment token | `0x3589f8d8b92a0787c6e4f5d64f44655c969e14824253ba352ac0205598724d02` |
| Approve input token for liquidity helper | `0x639f6395647e7b642edeadd86975760babc045e24837adb694af284ac7fb0b13` |
| Approve payment token for liquidity helper | `0x98de743e46dd1903ce2fb7985dff93e18d71124fddeb569317ebb99010cf60d0` |
| Approve input token for router | `0x9508c2c17ebe41f02e57559db3011048b18056d0bdf655c12d4178e0cf8a0f8c` |
| Initialize SafeHook pool | `0x7e1dc0cd0dc151a3d56ce528b8c74883ab697303c964358164992ac843673b6a` |
| Initialize VulnerableHook pool | `0x42d75f38c91725760f7c07ded07e9c2a836c11ffda098b9d20dc190718d60f8e` |
| Add liquidity to SafeHook pool | `0xe0c2ba6e23a6340988c818278b3b7ae5f63b07bbcd4e62e8a0182d00c55403a8` |
| Add liquidity to VulnerableHook pool | `0x57c1bdfd388fbc3977b12ef5105fd9c429dbed32f19a60a962d834561901505e` |
| Normal SafeHook x402 swap | `0x99c05216bbc402d2fcaa8eb6c9676941fd99175279d20c1a68e9bebab1dd0111` |
| Problematic VulnerableHook callback swap | `0x3cabb984726cc3ba4e4924d49eef377ce411d220f8de93424a6f54649c2cb32b` |

## Local Verification

```sh
npm install
npx hardhat compile
npx tsc --noEmit
SEPOLIA_RPC_URL=https://1rpc.io/sepolia npx hardhat test
```

## Live Deployment Command

```sh
npm run deploy:sepolia
```

The command reads `PRIVATE_KEY` from `.env`. If `SEPOLIA_RPC_URL` is absent, the Hardhat Sepolia network uses `https://1rpc.io/sepolia`.

## Audit Benchmark Notes

The safe hook is expected to reject invalid payment contexts, expired requests, wrong pools, wrong assets, reused payment IDs, untrusted routers, and nonzero callbacks.

The vulnerable hook is intentionally unsafe and includes missing access control, reentrancy-prone callback ordering, unchecked arithmetic, `tx.origin` authorization, unchecked ERC20 transfer handling, arbitrary external calls, and replayable payment IDs.
