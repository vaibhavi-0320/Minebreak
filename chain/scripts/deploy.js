const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  // Sepolia guard: require SEPOLIA_RPC_URL and DEPLOYER_PRIVATE_KEY
  if (chainId === 11155111) {
    if (!process.env.DEPLOYER_PRIVATE_KEY || !process.env.SEPOLIA_RPC_URL) {
      console.error("ERROR: SEPOLIA_RPC_URL and DEPLOYER_PRIVATE_KEY env vars are required for Sepolia deployment.");
      console.error("Copy chain/.env.example to chain/.env and fill in your values.");
      process.exit(1);
    }
  }

  console.log(`Deploying VaultBreak to chainId ${chainId}...`);

  const VaultBreak = await hre.ethers.getContractFactory("VaultBreak");
  const vaultBreak = await VaultBreak.deploy();
  await vaultBreak.waitForDeployment();

  const address = await vaultBreak.getAddress();
  const deployTx = vaultBreak.deploymentTransaction();
  let deployBlock = 0;
  if (deployTx) {
    const receipt = await deployTx.wait();
    deployBlock = receipt ? receipt.blockNumber : await hre.ethers.provider.getBlockNumber();
  } else {
    deployBlock = await hre.ethers.provider.getBlockNumber();
  }

  console.log(`VaultBreak deployed to: ${address} (block ${deployBlock})`);

  // Read ABI from compiled artifact
  const artifactPath = path.join(
    __dirname, "..", "artifacts", "contracts", "VaultBreak.sol", "VaultBreak.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Write / merge into src/duel/contract/VaultBreak.json
  const outPath = path.join(
    __dirname, "..", "..", "src", "duel", "contract", "VaultBreak.json"
  );
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Preserve existing deployments for other chains
  let contractData = { abi: artifact.abi, bytecode: artifact.bytecode, deployments: {} };
  if (fs.existsSync(outPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
      if (existing.deployments) {
        contractData.deployments = existing.deployments;
      }
    } catch (_) {}
  }

  // Remove any legacy chains if present
  delete contractData.deployments["80002"];

  contractData.deployments[String(chainId)] = { address, deployBlock };

  fs.writeFileSync(outPath, JSON.stringify(contractData, null, 2) + "\n");
  console.log(`Contract data written to src/duel/contract/VaultBreak.json`);
  console.log(`  Chain ${chainId} → ${address} (deployBlock: ${deployBlock})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
