require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-network-helpers");

// Load .env if present (dotenv is optional — not a hard dependency)
try { require("dotenv").config({ path: __dirname + "/.env" }); } catch (_) {}

// Guard: If targeting Sepolia, verify required env vars before proceeding
if (process.argv.includes("sepolia")) {
  if (!process.env.SEPOLIA_RPC_URL || !process.env.DEPLOYER_PRIVATE_KEY) {
    console.error("ERROR: SEPOLIA_RPC_URL and DEPLOYER_PRIVATE_KEY env vars are required for Sepolia. Stop.");
    process.exit(1);
  }
}

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      chainId: 11155111,
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

module.exports = config;
