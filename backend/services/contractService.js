/**
 * contractService.js - v3.0 Production
 *
 * ABI is now fully synced with CommunityFinance.sol v3.0.
 * Only real functions that exist in the contract are included.
 */

const { ethers } = require("ethers");
const logger     = require("../utils/logger");

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const ALCHEMY_KEY      = process.env.ALCHEMY_KEY;

// ── ABI (Only functions that actually exist in the contract) ──────
const ABI = [
  // ── Read: Groups ──────────────────────────────────────────────
  "function groupCount() external view returns (uint)",
  "function groups(uint) external view returns (uint id, string name, address creator, uint8 status, uint contribution, uint maxSize, uint tenure, uint fillDeadline, address borrower, uint emergencyCount, uint kickCount, uint totalPool, uint profitPool, bool isPrivate, uint completedLoans)",
  "function getMembers(uint gid) external view returns (address[])",
  "function getOpenGroups() external view returns (uint[])",
  "function getPendingGroups() external view returns (uint[])",
  "function getMyInvites(address user) external view returns (uint[])",
  "function getMyPrivateInvites(address user) external view returns (uint[])",
  "function isInvited(uint gid, address user) external view returns (bool)",
  "function getInvitedList(uint gid) external view returns (address[])",

  // ── Read: Loan & EMI ─────────────────────────────────────────
  "function getEMI(uint gid) external view returns (uint)",
  "function getLateFee(uint gid) external view returns (uint)",
  "function getNextDueTime(uint gid) external view returns (uint)",
  "function getRemainingMonths(uint gid) external view returns (uint)",
  "function getPoolBalance(uint gid) external view returns (uint)",
  "function getEMIinINR(uint gid) external view returns (uint)",
  "function getPoolInINR(uint gid) external view returns (uint)",

  // ── Read: Member info ─────────────────────────────────────────
  "function getMemberInfo(uint gid, address member) external view returns (uint creditScore, uint missed, uint onTime, uint late)",
  "function getCreditScore(uint gid, address member) external view returns (uint)",
  "function getProfitBalance(uint gid, address member) external view returns (uint)",
  "function getVoteCount(uint gid, address candidate) external view returns (uint)",

  // ── NEW Read: Investor / Analytics ────────────────────────────
  "function getTrustScore(uint gid, address member) external view returns (uint)",
  "function getGroupMetrics(uint gid) external view returns (uint totalMembers, bool activeLoan, uint poolETH, uint completedLoans)",
  "function getGroupHealth(uint gid) external view returns (uint fillPercentage, uint averageCreditScore, uint onTimeMemberCount, uint defaultedMemberCount, uint profitPoolAmount)",
  "function getGroupROI(uint gid) external view returns (uint principalReturned, uint profitEarned, uint roiPercentage, uint defaultRate)",

  // ── Read: Admin ──────────────────────────────────────────────
  "function admin() external view returns (address)",
  "function paused() external view returns (bool)",

  // ── Write: Group management ───────────────────────────────────
  "function createGroup(string calldata name, uint maxSize, uint tenure, bool isPrivate, address[] calldata invites) external payable",
  "function joinGroup(uint gid) external payable",
  "function leaveGroup(uint gid) external",
  "function expireGroup(uint gid) external",

  // ── Write: Invites ────────────────────────────────────────────
  "function inviteMember(uint gid, address invitee) external",
  "function revokeInvite(uint gid, address invitee) external",

  // ── Write: Voting ─────────────────────────────────────────────
  "function startVoting(uint gid) external",
  "function castVote(uint gid, address candidate) external",
  "function resolveVote(uint gid) external",
  "function releaseFunds(uint gid) external",

  // ── Write: EMI ────────────────────────────────────────────────
  "function payEMI(uint gid) external payable",
  "function checkAndMarkMissed(uint gid) external",

  // ── Write: Profit ─────────────────────────────────────────────
  "function withdrawAllProfit(uint gid) external",
  "function withdrawPartialProfit(uint gid, uint amount) external",

  // ── Write: Emergency ─────────────────────────────────────────
  "function raiseEmergency(uint gid, uint amount, string calldata reason) external",
  "function voteEmergency(uint gid, uint rid, bool support) external",
  "function resolveEmergency(uint gid, uint rid) external",
  "function repayEmergency(uint gid, uint rid) external payable",

  // ── Write: Kick ───────────────────────────────────────────────
  "function raiseKick(uint gid, address target) external",
  "function voteKick(uint gid, uint kid, bool support) external",
  "function resolveKick(uint gid, uint kid) external",

  // ── Write: Admin ──────────────────────────────────────────────
  "function approveGroup(uint gid) external",
  "function rejectGroup(uint gid) external",
  "function pause() external",
  "function unpause() external",

  // ── Events ────────────────────────────────────────────────────
  "event GroupCreated(uint indexed gid, address creator, string name, uint contribution, uint maxSize, uint tenure, bool isPrivate)",
  "event GroupApproved(uint indexed gid)",
  "event GroupRejected(uint indexed gid)",
  "event GroupClosed(uint indexed gid, string reason)",
  "event MemberJoined(uint indexed gid, address member)",
  "event MemberLeft(uint indexed gid, address member)",
  "event VotingStarted(uint indexed gid, uint endTime)",
  "event VoteCast(uint indexed gid, address voter, address candidate)",
  "event BorrowerSelected(uint indexed gid, address borrower, bool wasTie)",
  "event LoanReleased(uint indexed gid, address borrower, uint amount)",
  "event EMIPaid(uint indexed gid, address borrower, uint amount, uint month, uint lateFee)",
  "event LoanCompleted(uint indexed gid, uint round)",
  "event EMIMissed(uint indexed gid, address borrower, uint missedCount)",
  "event ProfitWithdrawn(uint indexed gid, address member, uint amount)",
  "event CreditUpdated(uint indexed gid, address member, uint newScore)",
  "event EmergencyRequested(uint indexed gid, uint indexed rid, address requester, uint amount, string reason)",
  "event EmergencyResolved(uint indexed gid, uint indexed rid, bool approved, uint yes, uint no)",
  "event EmergencyReleased(uint indexed gid, uint indexed rid, address requester, uint amount)",
  "event EmergencyRepaid(uint indexed gid, uint indexed rid, address requester, uint amount)",
  "event KickRaised(uint indexed gid, uint indexed kid, address target, address raisedBy)",
  "event KickResolved(uint indexed gid, uint indexed kid, address target, bool kicked)",
  "event MemberInvited(uint indexed gid, address indexed invitee)",
  "event InviteRevoked(uint indexed gid, address indexed invitee)",
];

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