/**
 * cronService.js - Missed EMI Auto-Detection (v3.1)
 *
 * Runs every hour. For all ACTIVE groups with a live loan:
 *   - If block.timestamp > nextDueTime + 30days → calls checkAndMarkMissed(gid)
 *   - This increments missedEMIs on-chain, enabling the kick system
 *
 * Requires CRON_SIGNER_PRIVATE_KEY in .env to sign the transaction.
 * Use a separate, minimal-permission wallet for this (not the admin key).
 * 
 * SECURITY: Credentials loaded once on startup, validated before use.
 * RELIABILITY: Exponential backoff with jitter for transient failures.
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
let cronContext = null; // Loaded once on startup

async function initCronContext() {
  const ALCHEMY_KEY      = process.env.ALCHEMY_KEY;
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  const CRON_SIGNER_KEY  = process.env.CRON_SIGNER_PRIVATE_KEY;

  // Validate all required config
  if (!ALCHEMY_KEY || !CONTRACT_ADDRESS || !CRON_SIGNER_KEY) {
    logger.warn("⚠️  CRON: Missing config (ALCHEMY_KEY, CONTRACT_ADDRESS, CRON_SIGNER_PRIVATE_KEY)");
    return null;
  }

  // Validate contract address format
  if (!ethers.isAddress(CONTRACT_ADDRESS)) {
    logger.error("❌ CRON: Invalid CONTRACT_ADDRESS format");
    return null;
  }

  try {
    const provider = new ethers.AlchemyProvider("sepolia", ALCHEMY_KEY);
    const signer   = new ethers.Wallet(CRON_SIGNER_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI_MINIMAL, signer);
    
    cronContext = { provider, signer, contract, contractAddress: CONTRACT_ADDRESS };
    logger.info(`✅ CRON: Context initialized. Signer: ${signer.address}`);
    return cronContext;
  } catch (err) {
    logger.error(`❌ CRON: Failed to initialize context: ${err.message}`);
    return null;
  }
}

async function checkMissedEMIs() {
  if (!cronContext) {
    logger.warn("⚠️  CRON: Not initialized. Skipping run.");
    return;
  }

  const { contract } = cronContext;

  try {
    const count = Number(await contract.groupCount());
    logger.info(`🕐 CRON: Checking ${count} groups for missed EMIs...`);

    let marked = 0;
    let failed = 0;

    for (let gid = 1; gid <= count; gid++) {
      try {
        const g = await contract.groups(gid);
        
        // Validate response before using
        if (!g || !g.status || !g.borrower) {
          logger.warn(`⚠️  CRON: Group ${gid} returned invalid data`);
          continue;
        }

        // Only ACTIVE groups (status === 2) with active loans
        if (Number(g.status) !== 2) continue;
        if (g.borrower === ethers.ZeroAddress) continue;

        // Retry logic with exponential backoff + jitter
        let retries = 0;
        const maxRetries = 3;
        let success = false;

        while (retries < maxRetries && !success) {
          try {
            const tx = await contract.checkAndMarkMissed(gid, {
              gasLimit: 100000,
            });
            await tx.wait();
            logger.info(`✅ CRON: Marked missed EMI for group ${gid}`);
            marked++;
            success = true;
          } catch (txErr) {
            const errMsg = txErr?.message || String(txErr);

            // Not an error - just not overdue yet
            if (errMsg.includes("Not yet overdue")) {
              success = true;
              break;
            }

            // Transient errors - retry with backoff
            const isTransient = errMsg.includes("ERR_NONCE") || 
                               errMsg.includes("INSUFFICIENT_FUNDS") || 
                               errMsg.includes("NETWORK_ERROR") ||
                               txErr?.code === "NETWORK_ERROR";

            if (isTransient && retries < maxRetries - 1) {
              retries++;
              // Exponential backoff with jitter: 2s + random(0-1s), 4s + random(0-1s), etc.
              const delay = 2000 * Math.pow(2, retries - 1) + Math.random() * 1000;
              logger.warn(`⏳ CRON: Retry ${retries}/${maxRetries} for group ${gid} (delay: ${Math.round(delay)}ms)`);
              await new Promise(r => setTimeout(r, delay));
            } else {
              throw txErr;
            }
          }
        }

        if (!success) {
          logger.error(`❌ CRON: Failed to mark group ${gid} after ${maxRetries} retries`);
          failed++;
        }
      } catch (e) {
        logger.error(`❌ CRON: Group ${gid} check failed: ${e.message || e}`);
        failed++;
      }
    }

    logger.info(`✅ CRON: Done. Marked ${marked} missed EMIs. Failed: ${failed}.`);
  } catch (err) {
    logger.error(`❌ CRON: Critical error: ${err.message}`);
  }
}

function startCronService() {
  logger.info("⏳ CRON: Initializing...");
  
  initCronContext().then(ctx => {
    if (!ctx) {
      logger.error("❌ CRON: Failed to initialize. Service will not run.");
      return;
    }

    // Run every hour at minute 0
    cronJob = cron.schedule("0 * * * *", async () => {
      logger.info("🕐 CRON: Running missed EMI check...");
      await checkMissedEMIs();
    });

    logger.info("✅ Cron service scheduled: missed EMI check every hour");

    // Also run immediately on startup to catch any already-overdue loans
    checkMissedEMIs().catch(e => logger.error(`CRON startup check failed: ${e.message}`));
  });
}

function stopCronService() {
  if (cronJob) {
    cronJob.stop();
    logger.info("🛑 Cron service stopped");
  }
}

module.exports = { startCronService, stopCronService };
