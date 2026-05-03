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

describeFork("Aegis402VulnerableHook audit benchmark cases", function () {
  it("allows unrestricted privileged state changes", async function () {
    const f = await loadFixture(deployBaseFixture);

    await f.vulnerableHook.connect(f.attacker).setGuardSigner(f.attacker.address);
    await f.vulnerableHook.connect(f.attacker).setAdmin(f.attacker.address);
    await f.vulnerableHook.connect(f.attacker).setFeeBps(42);

    expect(await f.vulnerableHook.guardSigner()).to.equal(f.attacker.address);
    expect(await f.vulnerableHook.admin()).to.equal(f.attacker.address);
    expect(await f.vulnerableHook.feeBps()).to.equal(42n);
  });

  it("performs arbitrary callback before settlement state is finalized", async function () {
    const f = await loadFixture(deployBaseFixture);
    const amountIn = ethers.parseEther("100");
    const required = ethers.parseEther("80");
    const receiver = await (await ethers.getContractFactory("MockMerchantReceiver")).deploy();

    const context = await makePaymentContext({
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
      context.paymentId
    ]);

    await expect(
      f.router
        .connect(f.payer)
        .swapExactInput(
          f.vulnerablePool.key,
          f.vulnerablePool.zeroForOne,
          amountIn,
          priceLimit(f.vulnerablePool.zeroForOne),
          encodeHookData(context, await receiver.getAddress(), callbackData)
        )
    )
      .to.emit(receiver, "CallbackObserved")
      .withArgs(await f.vulnerableHook.getAddress(), context.paymentId, 1, await f.vulnerableHook.getAddress())
      .and.to.emit(f.vulnerableHook, "PaymentReady")
      .withArgs(
        context.paymentId,
        f.payer.address,
        f.merchant.address,
        await receiver.getAddress(),
        await f.paymentToken.getAddress(),
        required,
        anyValue
      );

    expect(await f.vulnerableHook.paymentStatus(context.paymentId)).to.equal(2n);
    expect(await receiver.lastObservedStatus()).to.equal(1n);
  });

  it("uses tx.origin so a forwarding contract can satisfy payer auth incorrectly", async function () {
    const f = await loadFixture(deployBaseFixture);
    const amountIn = ethers.parseEther("100");
    const required = ethers.parseEther("80");
    const forwarder = await (await ethers.getContractFactory("ForwardingSwapper")).deploy();
    await f.inputToken.mint(await forwarder.getAddress(), ethers.parseEther("1000"));

    const context = await makePaymentContext({
      hookAddress: await f.vulnerableHook.getAddress(),
      guard: f.guard,
      payer: f.payer.address,
      merchant: f.merchant.address,
      payTo: f.merchant.address,
      asset: await f.paymentToken.getAddress(),
      amount: required,
      minOut: required,
      poolId: poolId(f.vulnerablePool.key)
    });

    await expect(
      forwarder
        .connect(f.payer)
        .forwardSwap(
          await f.router.getAddress(),
          f.vulnerablePool.key,
          f.vulnerablePool.zeroForOne,
          amountIn,
          priceLimit(f.vulnerablePool.zeroForOne),
          encodeHookData(context)
        )
    ).to.emit(f.vulnerableHook, "PaymentReady");
  });

  it("wraps unchecked arithmetic and records false-return token transfers as settled", async function () {
    const f = await loadFixture(deployBaseFixture);

    await f.vulnerableHook.setFeeBps(ethers.MaxUint256);
    await f.vulnerableHook.unsafeCredit(f.attacker.address, 2);
    expect(await f.vulnerableHook.escrowBalance(f.attacker.address)).to.equal(ethers.MaxUint256 - 1n);

    await f.vulnerableHook.unsafeRefund(f.merchant.address, 1);
    expect(await f.vulnerableHook.escrowBalance(f.merchant.address)).to.equal(ethers.MaxUint256);

    const falseToken = await (await ethers.getContractFactory("FalseReturnERC20")).deploy();
    const paymentId = ethers.id("unchecked-transfer-settled");

    await f.vulnerableHook.uncheckedPayout(await falseToken.getAddress(), f.merchant.address, 1, paymentId);
    expect(await f.vulnerableHook.paymentStatus(paymentId)).to.equal(2n);
  });

  it("allows the same paymentId to be settled repeatedly", async function () {
    const f = await loadFixture(deployBaseFixture);
    const amountIn = ethers.parseEther("100");
    const required = ethers.parseEther("80");

    const context = await makePaymentContext({
      hookAddress: await f.vulnerableHook.getAddress(),
      guard: f.guard,
      payer: f.payer.address,
      merchant: f.merchant.address,
      payTo: f.merchant.address,
      asset: await f.paymentToken.getAddress(),
      amount: required,
      minOut: required,
      poolId: poolId(f.vulnerablePool.key)
    });
    const hookData = encodeHookData(context);

    await f.router
      .connect(f.payer)
      .swapExactInput(
        f.vulnerablePool.key,
        f.vulnerablePool.zeroForOne,
        amountIn,
        priceLimit(f.vulnerablePool.zeroForOne),
        hookData
      );

    await expect(
      f.router
        .connect(f.payer)
        .swapExactInput(
          f.vulnerablePool.key,
          f.vulnerablePool.zeroForOne,
          amountIn,
          priceLimit(f.vulnerablePool.zeroForOne),
          hookData
        )
    ).to.emit(f.vulnerableHook, "PaymentReady");
  });
});

