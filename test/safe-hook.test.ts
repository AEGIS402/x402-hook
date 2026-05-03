import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import {
  deployBaseFixture,
  encodeHookData,
  makePaymentContext,
  poolId,
  priceLimit
} from "./helpers/aegis402";

const describeFork = process.env.SEPOLIA_RPC_URL ? describe : describe.skip;

describeFork("Aegis402SafeHook on a Sepolia fork", function () {
  it("emits PaymentReady for a valid x402 payment context and exact-input v4 swap", async function () {
    const f = await loadFixture(deployBaseFixture);
    const amountIn = ethers.parseEther("100");
    const required = ethers.parseEther("80");

    const context = await makePaymentContext({
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

    await expect(
      f.router
        .connect(f.payer)
        .swapExactInput(
          f.safePool.key,
          f.safePool.zeroForOne,
          amountIn,
          priceLimit(f.safePool.zeroForOne),
          encodeHookData(context)
        )
    )
      .to.emit(f.safeHook, "PaymentReady")
      .withArgs(
        context.paymentId,
        f.payer.address,
        f.merchant.address,
        f.merchant.address,
        await f.paymentToken.getAddress(),
        required,
        anyValue
      );

    expect(await f.safeHook.paymentStatus(context.paymentId)).to.equal(2n);
  });

  it("reverts invalid contexts before or after the swap", async function () {
    const f = await loadFixture(deployBaseFixture);
    const amountIn = ethers.parseEther("100");
    const required = ethers.parseEther("80");
    const swap = (hookData: string) =>
      f.router
        .connect(f.payer)
        .swapExactInput(f.safePool.key, f.safePool.zeroForOne, amountIn, priceLimit(f.safePool.zeroForOne), hookData);

    const baseArgs = {
      hookAddress: await f.safeHook.getAddress(),
      guard: f.guard,
      payer: f.payer.address,
      merchant: f.merchant.address,
      payTo: f.merchant.address,
      asset: await f.paymentToken.getAddress(),
      amount: required,
      minOut: required,
      poolId: poolId(f.safePool.key)
    };

    await expect(swap(encodeHookData(await makePaymentContext({ ...baseArgs, validUntilOffset: -1n })))).to.be.reverted;
    await expect(
      swap(encodeHookData(await makePaymentContext({ ...baseArgs, chainId: 1n })))
    ).to.be.reverted;
    await expect(
      swap(encodeHookData(await makePaymentContext({ ...baseArgs, poolId: ethers.ZeroHash })))
    ).to.be.reverted;
    await expect(
      swap(encodeHookData(await makePaymentContext({ ...baseArgs, asset: await f.inputToken.getAddress() })))
    ).to.be.reverted;
    await expect(
      swap(encodeHookData(await makePaymentContext({ ...baseArgs, riskApproved: false })))
    ).to.be.reverted;

    const wrongSignature = await makePaymentContext(baseArgs);
    wrongSignature.guardSignature = await f.attacker.signTypedData(
      {
        name: "AEGIS402Hook",
        version: "1",
        chainId: 11155111n,
        verifyingContract: await f.safeHook.getAddress()
      },
      {
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
      },
      {
        paymentId: wrongSignature.paymentId,
        payer: wrongSignature.payer,
        merchant: wrongSignature.merchant,
        payTo: wrongSignature.payTo,
        asset: wrongSignature.asset,
        amount: wrongSignature.amount,
        minOut: wrongSignature.minOut,
        validUntil: wrongSignature.validUntil,
        chainId: wrongSignature.chainId,
        poolId: wrongSignature.poolId,
        riskApproved: wrongSignature.riskApproved
      }
    );
    await expect(swap(encodeHookData(wrongSignature))).to.be.reverted;

    const callbackContext = await makePaymentContext(baseArgs);
    await expect(swap(encodeHookData(callbackContext, f.merchant.address, "0x"))).to.be.reverted;

    const tooHighMinOut = await makePaymentContext({
      ...baseArgs,
      amount: ethers.parseEther("1000000"),
      minOut: ethers.parseEther("1000000")
    });
    await expect(swap(encodeHookData(tooHighMinOut))).to.be.reverted;
  });

  it("blocks paymentId reuse and paused swaps", async function () {
    const f = await loadFixture(deployBaseFixture);
    const amountIn = ethers.parseEther("100");
    const required = ethers.parseEther("80");

    const context = await makePaymentContext({
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
    const hookData = encodeHookData(context);

    await f.router
      .connect(f.payer)
      .swapExactInput(f.safePool.key, f.safePool.zeroForOne, amountIn, priceLimit(f.safePool.zeroForOne), hookData);

    await expect(
      f.router
        .connect(f.payer)
        .swapExactInput(f.safePool.key, f.safePool.zeroForOne, amountIn, priceLimit(f.safePool.zeroForOne), hookData)
    ).to.be.reverted;

    const freshContext = await makePaymentContext({
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

    await f.safeHook.pause();
    await expect(
      f.router
        .connect(f.payer)
        .swapExactInput(
          f.safePool.key,
          f.safePool.zeroForOne,
          amountIn,
          priceLimit(f.safePool.zeroForOne),
          encodeHookData(freshContext)
        )
    ).to.be.reverted;
  });

  it("requires a trusted router msgSender that matches the payer", async function () {
    const f = await loadFixture(deployBaseFixture);
    const amountIn = ethers.parseEther("100");
    const required = ethers.parseEther("80");

    const context = await makePaymentContext({
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

    await f.safeHook.setTrustedRouter(await f.router.getAddress(), false);
    await expect(
      f.router
        .connect(f.payer)
        .swapExactInput(
          f.safePool.key,
          f.safePool.zeroForOne,
          amountIn,
          priceLimit(f.safePool.zeroForOne),
          encodeHookData(context)
        )
    ).to.be.reverted;

    await f.safeHook.setTrustedRouter(await f.router.getAddress(), true);
    const forwarder = await (await ethers.getContractFactory("ForwardingSwapper")).deploy();
    await f.inputToken.mint(await forwarder.getAddress(), ethers.parseEther("1000"));

    await expect(
      forwarder
        .connect(f.payer)
        .forwardSwap(
          await f.router.getAddress(),
          f.safePool.key,
          f.safePool.zeroForOne,
          amountIn,
          priceLimit(f.safePool.zeroForOne),
          encodeHookData(context)
        )
    ).to.be.reverted;
  });
});

