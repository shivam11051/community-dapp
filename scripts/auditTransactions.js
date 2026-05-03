const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🔍 TRANSACTION HISTORY AUDIT\n");
  console.log("═".repeat(60));

  const [owner] = await hre.ethers.getSigners();

  // Get deployed contract
  const deployment = JSON.parse(fs.readFileSync("contracts/deployment.json", "utf8"));
  const contractAddress = deployment.address;
  console.log(`✅ Contract: ${contractAddress}\n`);

  const contract = await hre.ethers.getContractAt("CommunityFinance", contractAddress);
  const provider = hre.ethers.provider;

  // Get current block
  const currentBlock = await provider.getBlockNumber();
  console.log(`📊 Current block: ${currentBlock}`);
  console.log(`📊 Block range for query: ${Math.max(0, currentBlock - 10000)} to ${currentBlock}\n`);

  // List all event names to check
  const eventNames = [
    "GroupCreated", "GroupApproved", "MemberJoined", "VotingStarted", 
    "BorrowerSelected", "LoanReleased", "EMIPaid", "ProfitWithdrawn",
    "EmergencyRequested", "EmergencyResolved", "EmergencyReleased", "EmergencyRepaid",
    "KickRaised", "KickResolved", "CreditUpdated", "VoteCast"
  ];

  console.log("═".repeat(60));
  console.log("QUERYING ALL EVENTS (Last 10,000 blocks)");
  console.log("═".repeat(60));

  const fromBlock = Math.max(0, currentBlock - 10000);
  let totalEvents = 0;

  for (const eventName of eventNames) {
    try {
      // Try to get the filter function
      const filterFn = contract.filters[eventName];
      
      if (!filterFn) {
        console.log(`⚠️  ${eventName}: Filter not found (check spelling)`);
        continue;
      }

      // Query for all events of this type
      const events = await contract.queryFilter(
        filterFn(),
        fromBlock,
        currentBlock
      );

      console.log(`✅ ${eventName.padEnd(20)} : ${events.length} events`);
      totalEvents += events.length;

      // Show first event as sample
      if (events.length > 0) {
        const first = events[0];
        console.log(`   └─ Sample: Block ${first.blockNumber}, TX: ${first.transactionHash.slice(0, 12)}...`);
      }
    } catch (err) {
      console.log(`❌ ${eventName.padEnd(20)} : Error - ${err.message.slice(0, 40)}`);
    }
  }

  console.log("\n" + "═".repeat(60));
  console.log(`📈 TOTAL EVENTS: ${totalEvents}`);
  console.log("═".repeat(60));

  // Check for groups
  const groupCount = await contract.groupCount();
  console.log(`\n📊 Total groups: ${groupCount}`);

  if (groupCount > 0) {
    console.log("\nGroup-specific event counts:");
    for (let gid = 0; gid < groupCount; gid++) {
      let groupEventCount = 0;

      for (const eventName of eventNames) {
        try {
          const filterFn = contract.filters[eventName];
          if (!filterFn) continue;

          const events = await contract.queryFilter(
            filterFn(gid),
            fromBlock,
            currentBlock
          );
          groupEventCount += events.length;
        } catch {
          // Skip
        }
      }

      console.log(`  Group #${gid}: ${groupEventCount} events`);
    }
  }

  console.log("\n" + "═".repeat(60));
  console.log("💡 NOTE: Queries are limited to last 10,000 blocks (~1.5 days)");
  console.log("   For older events, increase fromBlock in TransactionHistory.js");
  console.log("═".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ ERROR:", error);
    process.exitCode = 1;
  });
