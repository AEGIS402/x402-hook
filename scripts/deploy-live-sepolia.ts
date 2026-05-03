import fs from "node:fs";
import { ethers } from "hardhat";
import {
  AbiCoder,
  ContractFactory,
  MaxUint256,
  Signer,
  ZeroAddress,
  ZeroHash,
  concat,
  formatEther,
  getCreate2Address,
  keccak256,
  toBeHex,
  zeroPadValue
} from "ethers";

import {
  FEE,
  HOOK_DATA_TUPLE,
  MAX_SQRT_PRICE_MINUS_ONE,
  MIN_SQRT_PRICE_PLUS_ONE,
  PAYMENT_CONTEXT_TYPES,
  POOL_MODIFY_LIQUIDITY_TEST_ABI,
  SEPOLIA_UNISWAP_V4,
  SQRT_PRICE_1_1,
  TICK_LOWER,
  TICK_SPACING,
  TICK_UPPER,
  buildPoolKey,
  encodeHookData,
  poolId,
  priceLimit
} from "../test/helpers/aegis402";

const HOOK_FLAGS = 0xc0n;
const HOOK_FLAG_MASK = 0x3fffn;
const abi = AbiCoder.defaultAbiCoder();

type TxRecord = {
  label: string;
  hash: string;
};

type AddressRecord = {
  label: string;
  address: string;
};

type PaymentContext = {
  paymentId: string;
  payer: string;
  merchant: string;
  payTo: string;
  asset: string;
  amount: bigint;
  minOut: bigint;
  validUntil: bigint;
  chainId: bigint;
  poolId: string;
  riskApproved: boolean;
  guardSignature: string;
};

function mineHookSalt(deployerAddress: string, initCode: string) {
  const initCodeHash = keccak256(initCode);

  for (let i = 0n; i < 1_500_000n; i++) {
    const salt = zeroPadValue(toBeHex(i), 32);
    const hookAddress = getCreate2Address(deployerAddress, salt, initCodeHash);

    if ((BigInt(hookAddress) & HOOK_FLAG_MASK) === HOOK_FLAGS) {
      return { salt, hookAddress };
    }
  }

  throw new Error("Unable to mine a beforeSwap/afterSwap hook address");
}

async function deployContract(
  name: string,
  args: unknown[],
  txs: TxRecord[],
  addresses: AddressRecord[],
  label = name
) {
  const contract = await (await ethers.getContractFactory(name)).deploy(...args);
  const tx = contract.deploymentTransaction();
  if (!tx) throw new Error(`Missing deployment transaction for ${name}`);
  console.log(`Broadcast ${name}: ${tx.hash}`);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  txs.push({ label: `Deploy ${name}`, hash: tx.hash });
  addresses.push({ label, address });
  console.log(`${name}: ${address}`);
  return contract as any;
}

async function deployHookWithCreate2(
  create2Deployer: any,
  contractName: "Aegis402SafeHook" | "Aegis402VulnerableHook",
  args: unknown[],
  txs: TxRecord[],
  addresses: AddressRecord[]
) {
  const factory: ContractFactory = await ethers.getContractFactory(contractName);
  const initCode = concat([factory.bytecode, factory.interface.encodeDeploy(args)]);
  const { salt, hookAddress } = mineHookSalt(await create2Deployer.getAddress(), initCode);

  const tx = await create2Deployer.deploy(salt, initCode);
  console.log(`Broadcast ${contractName} via CREATE2: ${tx.hash}`);
  await tx.wait();

  txs.push({ label: `Deploy ${contractName}`, hash: tx.hash });
  addresses.push({ label: contractName, address: hookAddress });
  console.log(`${contractName}: ${hookAddress}`);

  return ethers.getContractAt(contractName, hookAddress);
}

async function waitTx(label: string, txPromise: Promise<any>, txs: TxRecord[]) {
  const tx = await txPromise;
  console.log(`Broadcast ${label}: ${tx.hash}`);
  await tx.wait();
  txs.push({ label, hash: tx.hash });
  return tx.hash;
}

async function signPaymentContext(hookAddress: string, signer: Signer, context: Omit<PaymentContext, "guardSignature">) {
  return (signer as any).signTypedData(
    {
      name: "AEGIS402Hook",
      version: "1",
      chainId: context.chainId,
      verifyingContract: hookAddress
    },
    PAYMENT_CONTEXT_TYPES,
    context
  );
}

async function makePaymentContext(args: {
  hookAddress: string;
  guard: Signer;
  payer: string;
  merchant: string;
  payTo: string;
  asset: string;
  amount: bigint;
  minOut: bigint;
  poolId: string;
  paymentIdLabel: string;
}) {
  const latest = await ethers.provider.getBlock("latest");
  if (!latest) throw new Error("Unable to read latest block");

  const base = {
    paymentId: ethers.id(args.paymentIdLabel),
    payer: args.payer,
    merchant: args.merchant,
    payTo: args.payTo,
    asset: args.asset,
    amount: args.amount,
    minOut: args.minOut,
    validUntil: BigInt(latest.timestamp) + 86_400n,
    chainId: 11155111n,
    poolId: args.poolId,
    riskApproved: true
  };

  return {
    ...base,
    guardSignature: await signPaymentContext(args.hookAddress, args.guard, base)
  };
}

function renderMarkdown(args: {
  deployer: string;
  balanceAfter: string;
  addresses: AddressRecord[];
  txs: TxRecord[];
  safePaymentId: string;
  vulnerablePaymentId: string;
  safePoolId: string;
  vulnerablePoolId: string;
  normalTxHash: string;
  problematicTxHash: string;
}) {
  const addressRows = args.addresses.map((item) => `| ${item.label} | \`${item.address}\` |`).join("\n");
  const txRows = args.txs.map((item) => `| ${item.label} | \`${item.hash}\` |`).join("\n");

  return `# AEGIS402 x402 Hook Audit Demo

This repository contains a minimal AEGIS402 x402-aware Uniswap v4 hook audit benchmark.

The live Sepolia deployment below uses the official Uniswap v4 Sepolia \`PoolManager\` and \`PoolModifyLiquidityTest\` contracts. The SafeHook demonstrates the expected payment-context validation path. The VulnerableHook intentionally keeps the same outer shape while exposing audit benchmark issues.

## Live Sepolia Deployment

Deployment date: ${new Date().toISOString()}

Deployer: \`${args.deployer}\`

Deployer balance after deployment: \`${args.balanceAfter} Sepolia ETH\`

Official Uniswap v4 Sepolia contracts:

| Contract | Address |
| --- | --- |
| PoolManager | \`${SEPOLIA_UNISWAP_V4.poolManager}\` |
| PoolModifyLiquidityTest | \`${SEPOLIA_UNISWAP_V4.poolModifyLiquidityTest}\` |
| StateView | \`${SEPOLIA_UNISWAP_V4.stateView}\` |
| Quoter | \`${SEPOLIA_UNISWAP_V4.quoter}\` |

Deployed demo contracts:

| Contract | Address |
| --- | --- |
${addressRows}

Pool identifiers:

| Pool | Pool ID |
| --- | --- |
| SafeHook pool | \`${args.safePoolId}\` |
| VulnerableHook pool | \`${args.vulnerablePoolId}\` |

Demo transactions:

| Scenario | Transaction Hash |
| --- | --- |
| Normal SafeHook x402 swap | \`${args.normalTxHash}\` |
| Problematic VulnerableHook callback swap | \`${args.problematicTxHash}\` |

Payment identifiers:

| Scenario | Payment ID |
| --- | --- |
| Normal SafeHook x402 swap | \`${args.safePaymentId}\` |
| Problematic VulnerableHook callback swap | \`${args.vulnerablePaymentId}\` |

All broadcast transactions:

| Step | Transaction Hash |
| --- | --- |
${txRows}

## Local Verification

\`\`\`sh
npm install
npx hardhat compile
npx tsc --noEmit
SEPOLIA_RPC_URL=https://1rpc.io/sepolia npx hardhat test
\`\`\`

## Live Deployment Command

\`\`\`sh
npm run deploy:sepolia
\`\`\`

The command reads \`PRIVATE_KEY\` from \`.env\`. If \`SEPOLIA_RPC_URL\` is absent, the Hardhat Sepolia network uses \`https://1rpc.io/sepolia\`.

## Audit Benchmark Notes

The safe hook is expected to reject invalid payment contexts, expired requests, wrong pools, wrong assets, reused payment IDs, untrusted routers, and nonzero callbacks.

The vulnerable hook is intentionally unsafe and includes missing access control, reentrancy-prone callback ordering, unchecked arithmetic, \`tx.origin\` authorization, unchecked ERC20 transfer handling, arbitrary external calls, and replayable payment IDs.
`;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No Sepolia deployer account configured");

  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 11155111n) {
    throw new Error(`Expected Sepolia chainId 11155111, got ${network.chainId}`);
  }

  const deployerAddress = await deployer.getAddress();
  const balanceBefore = await ethers.provider.getBalance(deployerAddress);
  console.log(`Deployer: ${deployerAddress}`);
  console.log(`Balance before: ${formatEther(balanceBefore)} Sepolia ETH`);

  const poolManagerCode = await ethers.provider.getCode(SEPOLIA_UNISWAP_V4.poolManager);
  const liquidityHelperCode = await ethers.provider.getCode(SEPOLIA_UNISWAP_V4.poolModifyLiquidityTest);
  if (poolManagerCode === "0x") throw new Error("Official Sepolia PoolManager code not found");
  if (liquidityHelperCode === "0x") throw new Error("Official Sepolia PoolModifyLiquidityTest code not found");

  const txs: TxRecord[] = [];
  const addresses: AddressRecord[] = [];

  const inputToken = await deployContract("MockERC20", ["AEGIS Input Token", "AIN"], txs, addresses, "Input MockERC20");
  const paymentToken = await deployContract("MockERC20", ["x402 Payment Token", "X402"], txs, addresses, "Payment MockERC20");
  const create2Deployer = await deployContract("Create2Deployer", [], txs, addresses);

  const safeHook = await deployHookWithCreate2(
    create2Deployer,
    "Aegis402SafeHook",
    [SEPOLIA_UNISWAP_V4.poolManager, deployerAddress, deployerAddress],
    txs,
    addresses
  );
  const vulnerableHook = await deployHookWithCreate2(
    create2Deployer,
    "Aegis402VulnerableHook",
    [SEPOLIA_UNISWAP_V4.poolManager, deployerAddress, deployerAddress],
    txs,
    addresses
  );

  const router = await deployContract("Aegis402SwapRouter", [SEPOLIA_UNISWAP_V4.poolManager], txs, addresses);
  const receiver = await deployContract("MockMerchantReceiver", [], txs, addresses);

  await waitTx("SafeHook set trusted router", safeHook.setTrustedRouter(await router.getAddress(), true), txs);

  const safePool = buildPoolKey(await inputToken.getAddress(), await paymentToken.getAddress(), await safeHook.getAddress());
  const vulnerablePool = buildPoolKey(
    await inputToken.getAddress(),
    await paymentToken.getAddress(),
    await vulnerableHook.getAddress()
  );

  const poolManager = await ethers.getContractAt("IPoolManager", SEPOLIA_UNISWAP_V4.poolManager);
  const liquidityHelper = new ethers.Contract(
    SEPOLIA_UNISWAP_V4.poolModifyLiquidityTest,
    POOL_MODIFY_LIQUIDITY_TEST_ABI,
    deployer
  );

  const mintAmount = ethers.parseEther("1000000000000");
  await waitTx("Mint input token", inputToken.mint(deployerAddress, mintAmount), txs);
  await waitTx("Mint payment token", paymentToken.mint(deployerAddress, mintAmount), txs);
  await waitTx(
    "Approve input token for liquidity helper",
    inputToken.approve(SEPOLIA_UNISWAP_V4.poolModifyLiquidityTest, MaxUint256),
    txs
  );
  await waitTx(
    "Approve payment token for liquidity helper",
    paymentToken.approve(SEPOLIA_UNISWAP_V4.poolModifyLiquidityTest, MaxUint256),
    txs
  );
  await waitTx("Approve input token for router", inputToken.approve(await router.getAddress(), MaxUint256), txs);

  await waitTx("Initialize SafeHook pool", poolManager.initialize(safePool.key, SQRT_PRICE_1_1), txs);
  await waitTx("Initialize VulnerableHook pool", poolManager.initialize(vulnerablePool.key, SQRT_PRICE_1_1), txs);

  const liquidityParams = {
    tickLower: TICK_LOWER,
    tickUpper: TICK_UPPER,
    liquidityDelta: ethers.parseEther("1000000"),
    salt: ZeroHash
  };

  await waitTx("Add liquidity to SafeHook pool", liquidityHelper.modifyLiquidity(safePool.key, liquidityParams, "0x", false, false), txs);
  await waitTx(
    "Add liquidity to VulnerableHook pool",
    liquidityHelper.modifyLiquidity(vulnerablePool.key, liquidityParams, "0x", false, false),
    txs
  );

  const amountIn = ethers.parseEther("100");
  const required = ethers.parseEther("80");

  const safeContext = await makePaymentContext({
    hookAddress: await safeHook.getAddress(),
    guard: deployer,
    payer: deployerAddress,
    merchant: deployerAddress,
    payTo: deployerAddress,
    asset: await paymentToken.getAddress(),
    amount: required,
    minOut: required,
    poolId: poolId(safePool.key),
    paymentIdLabel: `live-safe-${Date.now()}`
  });
  const safeHookData = encodeHookData(safeContext);
  const normalTxHash = await waitTx(
    "Normal SafeHook x402 swap",
    router.swapExactInput(safePool.key, safePool.zeroForOne, amountIn, priceLimit(safePool.zeroForOne), safeHookData),
    txs
  );

  const vulnerableContext = await makePaymentContext({
    hookAddress: await vulnerableHook.getAddress(),
    guard: deployer,
    payer: deployerAddress,
    merchant: deployerAddress,
    payTo: await receiver.getAddress(),
    asset: await paymentToken.getAddress(),
    amount: required,
    minOut: required,
    poolId: poolId(vulnerablePool.key),
    paymentIdLabel: `live-vulnerable-${Date.now()}`
  });
  const callbackData = receiver.interface.encodeFunctionData("observePaymentStatus", [
    await vulnerableHook.getAddress(),
    vulnerableContext.paymentId
  ]);
  const vulnerableHookData = abi.encode(
    [HOOK_DATA_TUPLE],
    [
      [
        [
          vulnerableContext.paymentId,
          vulnerableContext.payer,
          vulnerableContext.merchant,
          vulnerableContext.payTo,
          vulnerableContext.asset,
          vulnerableContext.amount,
          vulnerableContext.minOut,
          vulnerableContext.validUntil,
          vulnerableContext.chainId,
          vulnerableContext.poolId,
          vulnerableContext.riskApproved,
          vulnerableContext.guardSignature
        ],
        await receiver.getAddress(),
        callbackData
      ]
    ]
  );
  const problematicTxHash = await waitTx(
    "Problematic VulnerableHook callback swap",
    router.swapExactInput(
      vulnerablePool.key,
      vulnerablePool.zeroForOne,
      amountIn,
      vulnerablePool.zeroForOne ? MIN_SQRT_PRICE_PLUS_ONE : MAX_SQRT_PRICE_MINUS_ONE,
      vulnerableHookData
    ),
    txs
  );

  const balanceAfter = await ethers.provider.getBalance(deployerAddress);
  const markdown = renderMarkdown({
    deployer: deployerAddress,
    balanceAfter: formatEther(balanceAfter),
    addresses,
    txs,
    safePaymentId: safeContext.paymentId,
    vulnerablePaymentId: vulnerableContext.paymentId,
    safePoolId: poolId(safePool.key),
    vulnerablePoolId: poolId(vulnerablePool.key),
    normalTxHash,
    problematicTxHash
  });

  fs.writeFileSync("README.md", markdown);
  console.log("README.md updated with live Sepolia deployment details.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
