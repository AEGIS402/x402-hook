import { ethers } from "hardhat";

import {
  deployBaseFixture,
  encodeHookData,
  makePaymentContext,
  poolId,
  priceLimit
} from "../test/helpers/aegis402";

async function main() {
  if (!process.env.SEPOLIA_RPC_URL) {
    throw new Error("Set SEPOLIA_RPC_URL before running the Sepolia fork demo");
  }

  console.log("AEGIS402 x402 Hook Audit Demo");
  console.log("Network: Hardhat Sepolia fork");

  const f = await deployBaseFixture();
  const amountIn = ethers.parseEther("100");
  const required = ethers.parseEther("80");

  console.log("Official PoolManager:", await f.poolManager.getAddress());
  console.log("Input token:", await f.inputToken.getAddress());
  console.log("Payment token:", await f.paymentToken.getAddress());
  console.log("Safe hook:", await f.safeHook.getAddress());
  console.log("Vulnerable hook:", await f.vulnerableHook.getAddress());
  console.log("Router:", await f.router.getAddress());

  const safeContext = await makePaymentContext({
    hookAddress: await f.safeHook.getAddress(),
    guard: f.guard,
    payer: f.payer.address,
    merchant: f.merchant.address,
    payTo: f.merchant.address,
    asset: await f.paymentToken.getAddress(),
    amount: required,
    minOut: required,
    poolId: poolId(f.safePool.key)
  });

  const safeTx = await f.router
    .connect(f.payer)
    .swapExactInput(
      f.safePool.key,
      f.safePool.zeroForOne,
      amountIn,
      priceLimit(f.safePool.zeroForOne),
      encodeHookData(safeContext)
    );
  await safeTx.wait();
  console.log("SafeHook PaymentReady:", safeContext.paymentId);

  const receiver = await (await ethers.getContractFactory("MockMerchantReceiver")).deploy();
  const vulnerableContext = await makePaymentContext({
    hookAddress: await f.vulnerableHook.getAddress(),
    guard: f.guard,
    payer: f.payer.address,
    merchant: f.merchant.address,
    payTo: await receiver.getAddress(),
    asset: await f.paymentToken.getAddress(),
    amount: required,
    minOut: required,
    poolId: poolId(f.vulnerablePool.key)
  });
  const callbackData = receiver.interface.encodeFunctionData("observePaymentStatus", [
    await f.vulnerableHook.getAddress(),
    vulnerableContext.paymentId
  ]);

  const vulnerableTx = await f.router
    .connect(f.payer)
    .swapExactInput(
      f.vulnerablePool.key,
      f.vulnerablePool.zeroForOne,
      amountIn,
      priceLimit(f.vulnerablePool.zeroForOne),
      encodeHookData(vulnerableContext, await receiver.getAddress(), callbackData)
    );
  await vulnerableTx.wait();

  console.log("VulnerableHook PaymentReady:", vulnerableContext.paymentId);
  console.log("Vulnerable callback observed status before settlement:", (await receiver.lastObservedStatus()).toString());
  console.log("Demo complete");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

