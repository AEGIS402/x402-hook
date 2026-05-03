import { config as loadEnv } from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

loadEnv();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const LIVE_SEPOLIA_RPC_URL = SEPOLIA_RPC_URL || "https://1rpc.io/sepolia";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    hardhat: {
      chainId: 11155111,
      hardfork: "cancun",
      forking: SEPOLIA_RPC_URL
        ? {
            url: SEPOLIA_RPC_URL
          }
        : undefined
    },
    sepolia: {
      url: LIVE_SEPOLIA_RPC_URL,
      chainId: 11155111,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  }
};

export default config;
