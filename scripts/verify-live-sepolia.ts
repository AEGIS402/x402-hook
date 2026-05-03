import { run, ethers } from "hardhat";

const DEPLOYMENTS = {
  inputToken: "0x7E18Bb46c48fa9af923f841BF050da2E8A215029",
  paymentToken: "0xB517249EcCf1DcE96179bae820d5fA42124C6287",
  create2Deployer: "0x57ac905b46054c0Cba68c71770ad849e63317051",
  safeHook: "0xc4680Ab74eB4a4F7379016aa7b6044380Ae4C0C0",
  vulnerableHook: "0x70fAA067bE47D8dc839088Dcfc6f9338c07c80C0",
  router: "0x4DbDe978D7110728a8E248a18ce4D8Ee20E258E8",
  merchantReceiver: "0xAd385F9c8640cEf405f6269B132d2bcb0fA8b58c"
};

const POOL_MANAGER = "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543";

type VerifyTarget = {
  label: string;
  address: string;
  contract?: string;
  constructorArguments: unknown[];
};

async function verifyTarget(target: VerifyTarget) {
  console.log(`Verifying ${target.label}: ${target.address}`);

  try {
    await run("verify:verify", {
      address: target.address,
      contract: target.contract,
      constructorArguments: target.constructorArguments
    });
    console.log(`Verified ${target.label}`);
  } catch (error: any) {
    const message = error?.message ?? String(error);

    if (message.toLowerCase().includes("already verified")) {
      console.log(`${target.label} is already verified`);
      return;
    }

    throw error;
  }
}

async function main() {
  if (!process.env.ETHERSCAN_API_KEY) {
    throw new Error("Set ETHERSCAN_API_KEY in .env before running Sepolia Etherscan verification");
  }

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  const targets: VerifyTarget[] = [
    {
      label: "Input MockERC20",
      address: DEPLOYMENTS.inputToken,
      contract: "contracts/mocks/MockERC20.sol:MockERC20",
      constructorArguments: ["AEGIS Input Token", "AIN"]
    },
    {
      label: "Payment MockERC20",
      address: DEPLOYMENTS.paymentToken,
      contract: "contracts/mocks/MockERC20.sol:MockERC20",
      constructorArguments: ["x402 Payment Token", "X402"]
    },
    {
      label: "Create2Deployer",
      address: DEPLOYMENTS.create2Deployer,
      contract: "contracts/Create2Deployer.sol:Create2Deployer",
      constructorArguments: []
    },
    {
      label: "Aegis402SafeHook",
      address: DEPLOYMENTS.safeHook,
      contract: "contracts/Aegis402SafeHook.sol:Aegis402SafeHook",
      constructorArguments: [POOL_MANAGER, deployerAddress, deployerAddress]
    },
    {
      label: "Aegis402VulnerableHook",
      address: DEPLOYMENTS.vulnerableHook,
      contract: "contracts/Aegis402VulnerableHook.sol:Aegis402VulnerableHook",
      constructorArguments: [POOL_MANAGER, deployerAddress, deployerAddress]
    },
    {
      label: "Aegis402SwapRouter",
      address: DEPLOYMENTS.router,
      contract: "contracts/Aegis402SwapRouter.sol:Aegis402SwapRouter",
      constructorArguments: [POOL_MANAGER]
    },
    {
      label: "MockMerchantReceiver",
      address: DEPLOYMENTS.merchantReceiver,
      contract: "contracts/mocks/MockMerchantReceiver.sol:MockMerchantReceiver",
      constructorArguments: []
    }
  ];

  for (const target of targets) {
    await verifyTarget(target);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
