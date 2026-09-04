const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying with:", deployer.address);

  const Factory = await hre.ethers.getContractFactory("DocumentRegistry");
  const registry = await Factory.deploy(deployer.address);
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("DocumentRegistry deployed to:", address);

  const artifact = await hre.artifacts.readArtifact("DocumentRegistry");
  const sharedDir = path.join(__dirname, "..", "shared");
  fs.mkdirSync(sharedDir, { recursive: true });

  fs.writeFileSync(
    path.join(sharedDir, "DocumentRegistry.json"),
    JSON.stringify(
      {
        contractName: artifact.contractName,
        address,
        chainId: 31337,
        abi: artifact.abi
      },
      null,
      2
    )
  );

  console.log("ABI + address exported to shared/DocumentRegistry.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
