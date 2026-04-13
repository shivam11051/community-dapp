/**
 * contractService.js - v3.1 Production
 *
 * Now uses JSON ABI from compiled artifacts instead of human-readable strings.
 * This provides:
 * - More efficient encoding/decoding
 * - Better tooling support
 * - Full function metadata (inputs, outputs)
 * - Compatibility with all ethers tools
 */

const { ethers } = require("ethers");
const logger     = require("../utils/logger");

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const ALCHEMY_KEY      = process.env.ALCHEMY_KEY;

// ── Load JSON ABI from compiled artifacts ──────────────────────────
// This is the standard format used by ethers.js and all tools
let ABI;
try {
  const contractArtifact = require("../../artifacts/contracts/CommunityFinance.sol/CommunityFinance.json");
  ABI = contractArtifact.abi;
  logger.info(`✅ Loaded JSON ABI with ${ABI.length} items from artifact`);
} catch (err) {
  logger.error(`❌ Failed to load JSON ABI from artifact: ${err.message}`);
  // Fallback to a minimal ABI if artifact loading fails
  ABI = [
    "function groupCount() external view returns (uint)",
    "function groups(uint) external view returns (uint id, string name, address creator, uint8 status, uint contribution, uint maxSize, uint tenure, uint fillDeadline, address borrower, uint emergencyCount, uint kickCount, uint totalPool, uint profitPool, bool isPrivate, uint completedLoans)",
  ];
  logger.warn("Using minimal fallback ABI");
}

// ── INITIALIZER ──────────────────────────────────────────────────

let provider = null;
let contract = null;

function getProvider() {
  if (!provider) {
    provider = new ethers.AlchemyProvider("sepolia", ALCHEMY_KEY);
  }
  return provider;
}

function getContract() {
  if (!contract) {
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, getProvider());
  }
  return contract;
}

// ── Helpers ───────────────────────────────────────────────────────

async function getGroupCount() {
  return Number(await getContract().groupCount());
}

async function getGroupData(gid) {
  const c       = getContract();
  const g       = await c.groups(gid);
  const members = await c.getMembers(gid);

  return {
    id:             Number(g.id),
    name:           g.name,
    creator:        g.creator,
    status:         Number(g.status),
    contribution:   g.contribution.toString(),
    maxSize:        Number(g.maxSize),
    tenure:         Number(g.tenure),
    fillDeadline:   Number(g.fillDeadline),
    borrower:       g.borrower,
    emergencyCount: Number(g.emergencyCount),
    kickCount:      Number(g.kickCount),
    totalPool:      g.totalPool.toString(),
    profitPool:     g.profitPool.toString(),
    isPrivate:      g.isPrivate,
    completedLoans: Number(g.completedLoans),
    memberCount:    members.length,
    members,
  };
}

async function getGroupMetrics(gid) {
  const c = getContract();
  const [totalMembers, activeLoan, poolETH, completedLoans] =
    await c.getGroupMetrics(gid);

  return {
    totalMembers:   Number(totalMembers),
    activeLoan,
    poolETH:        poolETH.toString(),
    completedLoans: Number(completedLoans),
  };
}

async function getGroupHealth(gid) {
  const c = getContract();
  const [fillPct, avgCredit, onTimeCnt, defaultCnt, profitPool] =
    await c.getGroupHealth(gid);

  return {
    fillPercentage:        Number(fillPct),
    averageCreditScore:    Number(avgCredit),
    onTimeMemberCount:     Number(onTimeCnt),
    defaultedMemberCount:  Number(defaultCnt),
    profitPoolAmount:      profitPool.toString(),
  };
}

async function getGroupROI(gid) {
  const c = getContract();
  const [principalReturned, profitEarned, roiPct, defaultRate] =
    await c.getGroupROI(gid);

  return {
    principalReturned: principalReturned.toString(),
    profitEarned:      profitEarned.toString(),
    roiPercentage:     Number(roiPct),
    defaultRate:       Number(defaultRate),
  };
}

async function getMemberInfo(gid, address) {
  const c = getContract();
  const [creditScore, missed, onTime, late] =
    await c.getMemberInfo(gid, address);
  const trustScore = await c.getTrustScore(gid, address);

  return {
    creditScore:  Number(creditScore),
    missedEMIs:   Number(missed),
    onTimeEMIs:   Number(onTime),
    lateEMIs:     Number(late),
    trustScore:   Number(trustScore),
  };
}

async function calculateInvestmentScore(gid) {
  try {
    const health  = await getGroupHealth(gid);
    const roi     = await getGroupROI(gid);
    const metrics = await getGroupMetrics(gid);

    // Weighted score:
    // - average credit score (40%)
    // - fill % (20%)
    // - ROI % (20%)
    // - default rate penalty (20%)
    const score = Math.round(
      (health.averageCreditScore / 2) * 0.40 +
      health.fillPercentage           * 0.20 +
      Math.min(roi.roiPercentage, 100) * 0.20 -
      roi.defaultRate                  * 0.20
    );

    return Math.max(0, Math.min(100, score));
  } catch (e) {
    logger.warn(`Investment score failed for group ${gid}: ${e.message}`);
    return 50;
  }
}

module.exports = {
  getContract,
  getProvider,
  getGroupCount,
  getGroupData,
  getGroupMetrics,
  getGroupHealth,
  getGroupROI,
  getMemberInfo,
  calculateInvestmentScore,
};