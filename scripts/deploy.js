const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying CommunityFinance...");

  const CommunityFinance = await hre.ethers.getContractFactory("CommunityFinance");
  const contract = await CommunityFinance.deploy();

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ Contract deployed to:", address);

  // Save address to file
  const fs = require("fs");
  fs.writeFileSync(
    "contracts/deployment.json",
    JSON.stringify({ address, deployedAt: new Date().toISOString() }, null, 2)
  );

  console.log("📝 Address saved to contracts/deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });