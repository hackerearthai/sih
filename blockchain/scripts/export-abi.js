const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const artifact = await hre.artifacts.readArtifact("DocumentRegistry");
  const sharedDir = path.join(__dirname, "..", "shared");
  fs.mkdirSync(sharedDir, { recursive: true });

  let address = null;
  const deploymentFile = path.join(sharedDir, "DocumentRegistry.json");
  if (fs.existsSync(deploymentFile)) {
    try {
      address = JSON.parse(fs.readFileSync(deploymentFile, "utf8")).address;
    } catch (_) {}
  }

  fs.writeFileSync(
    deploymentFile,
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

  console.log("Exported shared/DocumentRegistry.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
