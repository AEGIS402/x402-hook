import { expect } from "chai";
import { ethers } from "hardhat";
import {
  AbiCoder,
  ContractFactory,
  MaxUint256,
  Signer,
  ZeroAddress,
  ZeroHash,
  concat,
  getCreate2Address,
  keccak256,
  toBeHex,
  zeroPadValue
} from "ethers";

export const SEPOLIA_UNISWAP_V4 = {
  poolManager: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543",
  poolModifyLiquidityTest: "0x0c478023803a644c94c4ce1c1e7b9a087e411b0a",
  stateView: "0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c",
  quoter: "0x61b3f2011a92d183c7dbadbda940a7555ccf9227"
};

export const HOOK_FLAGS = 0xc0n;
export const HOOK_FLAG_MASK = 0x3fffn;
export const FEE = 3000;
export const TICK_SPACING = 60;
export const TICK_LOWER = -887220;
export const TICK_UPPER = 887220;
export const SQRT_PRICE_1_1 = 79228162514264337593543950336n;
export const MIN_SQRT_PRICE_PLUS_ONE = 4295128740n;
export const MAX_SQRT_PRICE_MINUS_ONE = 1461446703485210103287273052203988822378723970341n;

export const POOL_MODIFY_LIQUIDITY_TEST_ABI = [
  "function modifyLiquidity((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key,(int24 tickLower,int24 tickUpper,int256 liquidityDelta,bytes32 salt) params,bytes hookData,bool settleUsingBurn,bool takeClaims) external payable returns (int256)"
];

export const CONTEXT_TUPLE =
  "tuple(bytes32 paymentId,address payer,address merchant,address payTo,address asset,uint256 amount,uint256 minOut,uint256 validUntil,uint256 chainId,bytes32 poolId,bool riskApproved,bytes guardSignature)";
export const HOOK_DATA_TUPLE = `tuple(${CONTEXT_TUPLE} context,address callbackTarget,bytes callbackData)`;

export const PAYMENT_CONTEXT_TYPES = {
  MinimalPaymentContext: [
    { name: "paymentId", type: "bytes32" },
    { name: "payer", type: "address" },
    { name: "merchant", type: "address" },
    { name: "payTo", type: "address" },
    { name: "asset", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "minOut", type: "uint256" },
    { name: "validUntil", type: "uint256" },
    { name: "chainId", type: "uint256" },
    { name: "poolId", type: "bytes32" },
    { name: "riskApproved", type: "bool" }
  ]
};

export type PoolKey = {
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
};

export type PaymentContext = {
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

const abi = AbiCoder.defaultAbiCoder();

export function sortedPair(a: string, b: string): [string, string] {
  return BigInt(a) < BigInt(b) ? [a, b] : [b, a];
}

export function buildPoolKey(inputToken: string, paymentToken: string, hook: string) {
  const [currency0, currency1] = sortedPair(inputToken, paymentToken);
  const key: PoolKey = {
    currency0,
    currency1,
    fee: FEE,
    tickSpacing: TICK_SPACING,
    hooks: hook
  };

  return {
    key,
    zeroForOne: inputToken.toLowerCase() === currency0.toLowerCase(),
    outputAsset: paymentToken
  };
}

export function poolId(key: PoolKey): string {
  return keccak256(
    abi.encode(
      ["tuple(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)"],
      [[key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]]
    )
  );
}

export function priceLimit(zeroForOne: boolean): bigint {
  return zeroForOne ? MIN_SQRT_PRICE_PLUS_ONE : MAX_SQRT_PRICE_MINUS_ONE;
}

export function encodeHookData(
  context: PaymentContext,
  callbackTarget: string = ZeroAddress,
  callbackData: string = "0x"
): string {
  return abi.encode(
    [HOOK_DATA_TUPLE],
    [
      [
        [
          context.paymentId,
          context.payer,
          context.merchant,
          context.payTo,
          context.asset,
          context.amount,
          context.minOut,
          context.validUntil,
          context.chainId,
          context.poolId,
          context.riskApproved,
          context.guardSignature
        ],
        callbackTarget,
        callbackData
      ]
    ]
  );
}

export async function signPaymentContext(
  hookAddress: string,
  signer: Signer,
  context: Omit<PaymentContext, "guardSignature"> & { guardSignature?: string }
): Promise<string> {
  return (signer as any).signTypedData(
    {
      name: "AEGIS402Hook",
      version: "1",
      chainId: context.chainId,
      verifyingContract: hookAddress
    },
    PAYMENT_CONTEXT_TYPES,
    {
      paymentId: context.paymentId,
      payer: context.payer,
      merchant: context.merchant,
      payTo: context.payTo,
      asset: context.asset,
      amount: context.amount,
      minOut: context.minOut,
      validUntil: context.validUntil,
      chainId: context.chainId,
      poolId: context.poolId,
      riskApproved: context.riskApproved
    }
  );
}

export async function signedContext(
  hookAddress: string,
  guard: Signer,
  base: Omit<PaymentContext, "guardSignature">
): Promise<PaymentContext> {
  const guardSignature = await signPaymentContext(hookAddress, guard, base);
  return { ...base, guardSignature };
}

export function mineHookSalt(deployerAddress: string, initCode: string) {
  const initCodeHash = keccak256(initCode);

  for (let i = 0n; i < 1_000_000n; i++) {
    const salt = zeroPadValue(toBeHex(i), 32);
    const hookAddress = getCreate2Address(deployerAddress, salt, initCodeHash);

    if ((BigInt(hookAddress) & HOOK_FLAG_MASK) === HOOK_FLAGS) {
      return { salt, hookAddress };
    }
  }

  throw new Error("Unable to mine a beforeSwap/afterSwap hook address");
}

export async function deployHookWithCreate2(
  deployer: any,
  contractName: "Aegis402SafeHook" | "Aegis402VulnerableHook",
  args: unknown[]
) {
  const factory: ContractFactory = await ethers.getContractFactory(contractName);
  const initCode = concat([factory.bytecode, factory.interface.encodeDeploy(args)]);
  const { salt, hookAddress } = mineHookSalt(await deployer.getAddress(), initCode);

  await deployer.deploy(salt, initCode);

  return {
    hook: (await ethers.getContractAt(contractName, hookAddress)) as any,
    hookAddress,
    salt
  };
}

export async function requireOfficialSepoliaContracts() {
  if (!process.env.SEPOLIA_RPC_URL) {
    throw new Error("SEPOLIA_RPC_URL is required for Sepolia fork tests and demo runs");
  }

  expect(await ethers.provider.getCode(SEPOLIA_UNISWAP_V4.poolManager)).to.not.equal("0x");
  expect(await ethers.provider.getCode(SEPOLIA_UNISWAP_V4.poolModifyLiquidityTest)).to.not.equal("0x");
}

export async function deployBaseFixture() {
  await requireOfficialSepoliaContracts();

  const [deployerSigner, payer, guard, merchant, attacker] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;

  const tokenFactory = await ethers.getContractFactory("MockERC20");
  const inputToken = await tokenFactory.deploy("AEGIS Input Token", "AIN");
  const paymentToken = await tokenFactory.deploy("x402 Payment Token", "X402");

  const create2Deployer = await (await ethers.getContractFactory("Create2Deployer")).deploy();
  const safeDeployment = await deployHookWithCreate2(create2Deployer, "Aegis402SafeHook", [
    SEPOLIA_UNISWAP_V4.poolManager,
    guard.address,
    deployerSigner.address
  ]);
  const vulnerableDeployment = await deployHookWithCreate2(create2Deployer, "Aegis402VulnerableHook", [
    SEPOLIA_UNISWAP_V4.poolManager,
    guard.address,
    deployerSigner.address
  ]);

  const router = await (await ethers.getContractFactory("Aegis402SwapRouter")).deploy(SEPOLIA_UNISWAP_V4.poolManager);
  await safeDeployment.hook.setTrustedRouter(await router.getAddress(), true);

  const safePool = buildPoolKey(await inputToken.getAddress(), await paymentToken.getAddress(), safeDeployment.hookAddress);
  const vulnerablePool = buildPoolKey(
    await inputToken.getAddress(),
    await paymentToken.getAddress(),
    vulnerableDeployment.hookAddress
  );

  const poolManager = await ethers.getContractAt("IPoolManager", SEPOLIA_UNISWAP_V4.poolManager);
  const liquidityHelper = new ethers.Contract(
    SEPOLIA_UNISWAP_V4.poolModifyLiquidityTest,
    POOL_MODIFY_LIQUIDITY_TEST_ABI,
    deployerSigner
  );

  const mintAmount = ethers.parseEther("1000000000000");
  await inputToken.mint(deployerSigner.address, mintAmount);
  await paymentToken.mint(deployerSigner.address, mintAmount);
  await inputToken.approve(SEPOLIA_UNISWAP_V4.poolModifyLiquidityTest, MaxUint256);
  await paymentToken.approve(SEPOLIA_UNISWAP_V4.poolModifyLiquidityTest, MaxUint256);

  await poolManager.initialize(safePool.key, SQRT_PRICE_1_1);
  await poolManager.initialize(vulnerablePool.key, SQRT_PRICE_1_1);

  const liquidityParams = {
    tickLower: TICK_LOWER,
    tickUpper: TICK_UPPER,
    liquidityDelta: ethers.parseEther("1000000"),
    salt: ZeroHash
  };

  await liquidityHelper.modifyLiquidity(safePool.key, liquidityParams, "0x", false, false);
  await liquidityHelper.modifyLiquidity(vulnerablePool.key, liquidityParams, "0x", false, false);

  const payerInput = ethers.parseEther("100000");
  await inputToken.mint(payer.address, payerInput);
  await inputToken.connect(payer).approve(await router.getAddress(), MaxUint256);

  return {
    chainId,
    deployer: deployerSigner,
    payer,
    guard,
    merchant,
    attacker,
    inputToken,
    paymentToken,
    create2Deployer,
    safeHook: safeDeployment.hook,
    vulnerableHook: vulnerableDeployment.hook,
    safePool,
    vulnerablePool,
    poolManager,
    liquidityHelper,
    router
  };
}

export async function makePaymentContext(args: {
  hookAddress: string;
  guard: Signer;
  payer: string;
  merchant: string;
  payTo: string;
  asset: string;
  amount: bigint;
  minOut: bigint;
  poolId: string;
  riskApproved?: boolean;
  validUntilOffset?: bigint;
  paymentId?: string;
  chainId?: bigint;
}) {
  const latest = await ethers.provider.getBlock("latest");
  if (!latest) throw new Error("Unable to read latest block");

  const base = {
    paymentId: args.paymentId || ethers.id(`aegis402:${Date.now()}:${Math.random()}`),
    payer: args.payer,
    merchant: args.merchant,
    payTo: args.payTo,
    asset: args.asset,
    amount: args.amount,
    minOut: args.minOut,
    validUntil: BigInt(latest.timestamp) + (args.validUntilOffset ?? 3600n),
    chainId: args.chainId ?? 11155111n,
    poolId: args.poolId,
    riskApproved: args.riskApproved ?? true
  };

  return signedContext(args.hookAddress, args.guard, base);
}
