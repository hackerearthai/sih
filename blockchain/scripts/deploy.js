const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log('Deploying with:', deployer.address);

  const Factory = await hre.ethers.getContractFactory('DocumentRegistry');
  const registry = await Factory.deploy(deployer.address);
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log('DocumentRegistry deployed to:', address);

  const artifact = await hre.artifacts.readArtifact('DocumentRegistry');
  const config = {
    contractName: artifact.contractName,
    address,
    chainId: 31337,
    abi: artifact.abi,
  };

  // Blockchain team's copy.
  const blockchainSharedDir = path.join(__dirname, '..', 'shared');
  fs.mkdirSync(blockchainSharedDir, { recursive: true });
  const blockchainConfigPath = path.join(blockchainSharedDir, 'DocumentRegistry.json');
  fs.writeFileSync(blockchainConfigPath, JSON.stringify(config, null, 2));

  // Backend integration copy.
  // This removes the manual "copy ABI/address after every deployment" step.
  const backendSharedDir = path.join(__dirname, '..', '..', 'backend', 'shared');
  fs.mkdirSync(backendSharedDir, { recursive: true });
  const backendConfigPath = path.join(backendSharedDir, 'DocumentRegistry.json');
  fs.writeFileSync(backendConfigPath, JSON.stringify(config, null, 2));

  console.log('ABI + address exported to:');
  console.log(`  ${blockchainConfigPath}`);
  console.log(`  ${backendConfigPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
