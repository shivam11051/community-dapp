/**
 * cronService.js - Missed EMI Auto-Detection (v3.0)
 *
 * Runs every hour. For all ACTIVE groups with a live loan:
 *   - If block.timestamp > nextDueTime + 30days → calls checkAndMarkMissed(gid)
 *   - This increments missedEMIs on-chain, enabling the kick system
 *
 * Requires PRIVATE_KEY in .env to sign the transaction (admin or any wallet with gas).
 */

const cron   = require("node-cron");
const { ethers } = require("ethers");
const logger = require("../utils/logger");

const ABI_MINIMAL = [
  "function groupCount() external view returns (uint)",
  "function groups(uint) external view returns (uint id, string name, address creator, uint8 status, uint contribution, uint maxSize, uint tenure, uint fillDeadline, address borrower, uint emergencyCount, uint kickCount, uint totalPool, uint profitPool, bool isPrivate, uint completedLoans)",
  "function checkAndMarkMissed(uint gid) external",
];

let cronJob = null;

async function checkMissedEMIs() {
  const ALCHEMY_KEY      = process.env.ALCHEMY_KEY;
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  const PRIVATE_KEY      = process.env.PRIVATE_KEY;

  if (!PRIVATE_KEY) {
    logger.warn("⚠️  CRON: PRIVATE_KEY not set — cannot mark missed EMIs");
    return;
  }

  try {
    const provider = new ethers.AlchemyProvider("sepolia", ALCHEMY_KEY);
    const signer   = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI_MINIMAL, signer);

    const count = Number(await contract.groupCount());
    logger.info(`🕐 CRON: Checking ${count} groups for missed EMIs...`);

    let marked = 0;

    for (let gid = 1; gid <= count; gid++) {
      try {
        const g = await contract.groups(gid);

        // Only ACTIVE groups (status === 2) with active loans
        if (Number(g.status) !== 2) continue;
        if (g.borrower === ethers.ZeroAddress) continue;

        // We can't read loan.nextDueTime directly from the packed struct,
        // so we rely on the contract's own check.
        // Try to call — contract will revert if not yet overdue.
        const tx = await contract.checkAndMarkMissed(gid, {
          gasLimit: 100000,
        });
        await tx.wait();

        logger.info(`✅ CRON: Marked missed EMI for group ${gid}`);
        marked++;
      } catch (e) {
        // "Not yet overdue" revert is expected — not an error
        if (!e.message.includes("Not yet overdue")) {
          logger.warn(`⚠️  CRON: Group ${gid} check failed: ${e.message}`);
        }
      }
    }

    logger.info(`✅ CRON: Done. Marked ${marked} missed EMIs.`);
  } catch (err) {
    logger.error(`❌ CRON: Critical error in checkMissedEMIs: ${err.message}`);
  }
}

function startCronService() {
  // Run every hour at minute 0
  cronJob = cron.schedule("0 * * * *", async () => {
    logger.info("🕐 CRON: Running missed EMI check...");
    await checkMissedEMIs();
  });

  logger.info("✅ Cron service scheduled: missed EMI check every hour");

  // Also run immediately on startup to catch any already-overdue loans
  checkMissedEMIs().catch(e => logger.error(`CRON startup check failed: ${e.message}`));
}

function stopCronService() {
  if (cronJob) {
    cronJob.stop();
    logger.info("🛑 Cron service stopped");
  }
}

module.exports = { startCronService, stopCronService };
