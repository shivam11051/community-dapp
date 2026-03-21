const { ethers } = require("ethers");
require("dotenv").config();

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const ALCHEMY_KEY = process.env.ALCHEMY_KEY;

// Complete contract ABI (read-only functions)
const CONTRACT_ABI = [
  // View functions
  "function groups(uint gid) external view returns (tuple(uint id, string name, address creator, uint8 status, uint contribution, uint maxSize, uint tenure, bool isPrivate, address[] members, uint memberCount, uint totalPool, uint fillDeadline, tuple(bool active, address borrower, uint principal, uint interestRate, uint monthlyPrincipal, uint monthlyInterest, uint monthsPaid, uint monthsDue) loan, uint profitPool))",
  "function getGroupCount() external view returns (uint)",
  "function getMembers(uint gid) external view returns (address[])",
  "function getMemberInfo(uint gid, address member) external view returns (tuple(uint creditScore, uint onTimeEMIs, uint lateEMIs, uint missedEMIs))",
  "function getMyInvites(address user) external view returns (uint[])",
  "function getEMIinINR(uint gid) external view returns (uint)",
  "function getPoolInINR(uint gid) external view returns (uint)",
  "function getTrustScore(uint gid, address member) external view returns (uint)",
  "function getGroupMetrics(uint gid) external view returns (uint totalMembers, uint activeLoan, uint poolETH, uint completedLoans)",
  "function getGroupHealth(uint gid) external view returns (uint fillPercentage, uint averageCreditScore, uint onTimeMemberCount, uint defaultedMemberCount, uint profitPoolAmount)",
  "function getGroupROI(uint gid) external view returns (uint principalReturned, uint profitEarned, uint roiPercentage, uint defaultRate)",
];

let provider;
let contract;

async function initContractService() {
  try {
    console.log("🔌 Initializing contract service...");
    provider = new ethers.JsonRpcProvider(ALCHEMY_KEY);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    console.log("✅ Contract service ready");
    return true;
  } catch (error) {
    console.error("❌ Contract service init failed:", error.message);
    return false;
  }
}

// ─────────────────────────────────────────────
// GROUP FUNCTIONS
// ─────────────────────────────────────────────

async function getGroupCount() {
  try {
    const count = await contract.getGroupCount();
    return Number(count);
  } catch (error) {
    console.error("❌ Error getting group count:", error.message);
    return 0;
  }
}

async function getGroupData(gid) {
  try {
    const group = await contract.groups(gid);
    return {
      id: Number(group.id),
      name: group.name,
      creator: group.creator,
      status: Number(group.status),
      contribution: group.contribution.toString(),
      maxSize: Number(group.maxSize),
      tenure: Number(group.tenure),
      isPrivate: group.isPrivate,
      memberCount: Number(group.memberCount),
      totalPool: group.totalPool.toString(),
      fillDeadline: Number(group.fillDeadline),
      profitPool: group.profitPool.toString(),
      loan: {
        active: group.loan.active,
        borrower: group.loan.borrower,
        principal: group.loan.principal.toString(),
        interestRate: Number(group.loan.interestRate),
        monthlyPrincipal: group.loan.monthlyPrincipal.toString(),
        monthlyInterest: group.loan.monthlyInterest.toString(),
        monthsPaid: Number(group.loan.monthsPaid),
        monthsDue: Number(group.loan.monthsDue),
      },
    };
  } catch (error) {
    console.error(`❌ Error getting group ${gid}:`, error.message);
    return null;
  }
}

async function getAllGroups() {
  try {
    const count = await getGroupCount();
    const groups = [];

    for (let i = 1; i <= count; i++) {
      const groupData = await getGroupData(i);
      if (groupData) {
        groups.push(groupData);
      }
    }

    return groups;
  } catch (error) {
    console.error("❌ Error getting all groups:", error.message);
    return [];
  }
}

// ─────────────────────────────────────────────
// MEMBER FUNCTIONS
// ─────────────────────────────────────────────

async function getMembers(gid) {
  try {
    const members = await contract.getMembers(gid);
    return members;
  } catch (error) {
    console.error(`❌ Error getting members for group ${gid}:`, error.message);
    return [];
  }
}

async function getMemberInfo(gid, memberAddress) {
  try {
    const info = await contract.getMemberInfo(gid, memberAddress);
    return {
      creditScore: Number(info.creditScore),
      onTimeEMIs: Number(info.onTimeEMIs),
      lateEMIs: Number(info.lateEMIs),
      missedEMIs: Number(info.missedEMIs),
    };
  } catch (error) {
    console.error(`❌ Error getting member info:`, error.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// INVESTOR FUNCTIONS (PHASE 5)
// ─────────────────────────────────────────────

async function getTrustScore(gid, memberAddress) {
  try {
    const score = await contract.getTrustScore(gid, memberAddress);
    return Number(score);
  } catch (error) {
    console.error(`❌ Error getting trust score:`, error.message);
    return 0;
  }
}

async function getGroupMetrics(gid) {
  try {
    const metrics = await contract.getGroupMetrics(gid);
    return {
      totalMembers: Number(metrics.totalMembers),
      activeLoan: Number(metrics.activeLoan),
      poolETH: metrics.poolETH.toString(),
      completedLoans: Number(metrics.completedLoans),
    };
  } catch (error) {
    console.error(`❌ Error getting group metrics:`, error.message);
    return null;
  }
}

async function getGroupHealth(gid) {
  try {
    const health = await contract.getGroupHealth(gid);
    return {
      fillPercentage: Number(health.fillPercentage),
      averageCreditScore: Number(health.averageCreditScore),
      onTimeMemberCount: Number(health.onTimeMemberCount),
      defaultedMemberCount: Number(health.defaultedMemberCount),
      profitPoolAmount: health.profitPoolAmount.toString(),
    };
  } catch (error) {
    console.error(`❌ Error getting group health:`, error.message);
    return null;
  }
}

async function getGroupROI(gid) {
  try {
    const roi = await contract.getGroupROI(gid);
    return {
      principalReturned: roi.principalReturned.toString(),
      profitEarned: roi.profitEarned.toString(),
      roiPercentage: Number(roi.roiPercentage),
      defaultRate: Number(roi.defaultRate),
    };
  } catch (error) {
    console.error(`❌ Error getting group ROI:`, error.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// INVITE FUNCTIONS
// ─────────────────────────────────────────────

async function getMyInvites(userAddress) {
  try {
    const invites = await contract.getMyInvites(userAddress);
    return invites.map(id => Number(id));
  } catch (error) {
    console.error(`❌ Error getting invites:`, error.message);
    return [];
  }
}

// ─────────────────────────────────────────────
// PRICE CONVERSION FUNCTIONS
// ─────────────────────────────────────────────

async function getEMIinINR(gid) {
  try {
    const inr = await contract.getEMIinINR(gid);
    return inr.toString();
  } catch (error) {
    console.error(`❌ Error getting EMI in INR:`, error.message);
    return "0";
  }
}

async function getPoolInINR(gid) {
  try {
    const inr = await contract.getPoolInINR(gid);
    return inr.toString();
  } catch (error) {
    console.error(`❌ Error getting pool in INR:`, error.message);
    return "0";
  }
}

module.exports = {
  initContractService,
  getGroupCount,
  getGroupData,
  getAllGroups,
  getMembers,
  getMemberInfo,
  getTrustScore,
  getGroupMetrics,
  getGroupHealth,
  getGroupROI,
  getMyInvites,
  getEMIinINR,
  getPoolInINR,
};