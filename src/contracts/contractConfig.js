/**
 * CENTRALIZED CONTRACT CONFIGURATION
 * 
 * Single source of truth for:
 * - Contract address
 * - Contract ABI
 * - Network configuration
 * 
 * Usage:
 * import { ADDRESS, ABI, NETWORK } from "../contracts/contractConfig";
 */

// ⚙️ CONTRACT ADDRESS (Sepolia Testnet)
export const ADDRESS = "0xe97B7c90598617aB247B55992707f9c62CD47228";

// ⚙️ CONTRACT ABI (Complete interface)
export const ABI = [
  // ─── EVENTS ──────────────────────────────────────────────────────────
  {
    type: "event",
    name: "GroupCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "contribution", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "GroupApproved",
    inputs: [{ name: "id", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "GroupRejected",
    inputs: [{ name: "id", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "MemberJoined",
    inputs: [
      { name: "groupId", type: "uint256", indexed: true },
      { name: "member", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "VotingStarted",
    inputs: [
      { name: "groupId", type: "uint256", indexed: true },
      { name: "endTime", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "VoteCast",
    inputs: [
      { name: "groupId", type: "uint256", indexed: true },
      { name: "voter", type: "address", indexed: true },
      { name: "candidate", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "BorrowerSelected",
    inputs: [
      { name: "groupId", type: "uint256", indexed: true },
      { name: "borrower", type: "address", indexed: true },
      { name: "wasTie", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LoanReleased",
    inputs: [
      { name: "groupId", type: "uint256", indexed: true },
      { name: "borrower", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "EMIPaid",
    inputs: [
      { name: "groupId", type: "uint256", indexed: true },
      { name: "borrower", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "month", type: "uint256", indexed: false },
      { name: "lateFee", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CreditUpdated",
    inputs: [
      { name: "groupId", type: "uint256", indexed: true },
      { name: "member", type: "address", indexed: true },
      { name: "newScore", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ProfitWithdrawn",
    inputs: [
      { name: "groupId", type: "uint256", indexed: true },
      { name: "member", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "EmergencyRequested",
    inputs: [
      { name: "groupId", type: "uint256", indexed: true },
      { name: "requestId", type: "uint256", indexed: false },
      { name: "requester", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "reason", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "EmergencyResolved",
    inputs: [
      { name: "groupId", type: "uint256", indexed: true },
      { name: "requestId", type: "uint256", indexed: false },
      { name: "approved", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "EmergencyReleased",
    inputs: [
      { name: "groupId", type: "uint256", indexed: true },
      { name: "requestId", type: "uint256", indexed: false },
      { name: "requester", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "KickRaised",
    inputs: [
      { name: "groupId", type: "uint256", indexed: true },
      { name: "kickId", type: "uint256", indexed: false },
      { name: "target", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "KickResolved",
    inputs: [
      { name: "groupId", type: "uint256", indexed: true },
      { name: "kickId", type: "uint256", indexed: false },
      { name: "target", type: "address", indexed: true },
      { name: "kicked", type: "bool", indexed: false },
    ],
  },

  // ─── READ FUNCTIONS ──────────────────────────────────────────────────
  {
    type: "function",
    name: "groupCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "groups",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "id", type: "uint256" },
      { name: "name", type: "string" },
      { name: "creator", type: "address" },
      { name: "contribution", type: "uint256" },
      { name: "maxSize", type: "uint256" },
      { name: "tenure", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "memberCount", type: "uint256" },
      { name: "totalPool", type: "uint256" },
      { name: "profitPool", type: "uint256" },
      { name: "borrower", type: "address" },
      { name: "isPrivate", type: "bool" },
      { name: "emergencyCount", type: "uint256" },
      { name: "kickCount", type: "uint256" },
      { name: "fillDeadline", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "inGroup",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "memberGroup",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMembers",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMemberInfo",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "member", type: "address" },
    ],
    outputs: [
      { name: "creditScore", type: "uint256" },
      { name: "missedPayments", type: "uint256" },
      { name: "onTimePayments", type: "uint256" },
      { name: "latePayments", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "votesReceived",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "candidate", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getOpenGroups",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPendingGroups",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCreditScore",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "member", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getEMI",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getEMIinINR",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLateFee",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getNextDueTime",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRemainingMonths",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getProfitBalance",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "member", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasVoted",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "member", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "emergencyRequests",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "requestId", type: "uint256" },
    ],
    outputs: [
      { name: "id", type: "uint256" },
      { name: "requester", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "reason", type: "string" },
      { name: "approved", type: "bool" },
      { name: "resolved", type: "bool" },
      { name: "yesVotes", type: "uint256" },
      { name: "noVotes", type: "uint256" },
      { name: "repaid", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "kickRequests",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "kickId", type: "uint256" },
    ],
    outputs: [
      { name: "id", type: "uint256" },
      { name: "target", type: "address" },
      { name: "raisedBy", type: "address" },
      { name: "approved", type: "bool" },
      { name: "resolved", type: "bool" },
      { name: "yesVotes", type: "uint256" },
      { name: "noVotes", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "activeEmergencyGroup",
    inputs: [{ name: "member", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "activeKick",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "member", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "paused",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },

  // ─── WRITE FUNCTIONS ─────────────────────────────────────────────────
  {
    type: "function",
    name: "createGroup",
    inputs: [
      { name: "name", type: "string" },
      { name: "contribution", type: "uint256" },
      { name: "maxSize", type: "uint256" },
      { name: "tenure", type: "uint256" },
      { name: "isPrivate", type: "bool" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "joinGroup",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "inviteMember",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "invitee", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeInvite",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "invitee", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "payEMI",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "castVote",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "candidate", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "startVoting",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resolveVote",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "releaseFunds",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawAllProfit",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawPartialProfit",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "raiseEmergency",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "reason", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "voteEmergency",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "requestId", type: "uint256" },
      { name: "support", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resolveEmergency",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "requestId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "repayEmergency",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "requestId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "raiseKick",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "target", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "voteKick",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "kickId", type: "uint256" },
      { name: "support", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resolveKick",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "kickId", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "approveGroup",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "rejectGroup",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "expireGroup",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "pause",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "unpause",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getMyInvites",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMyPrivateInvites",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isInvited",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
];

// ⚙️ NETWORK CONFIG
export const NETWORK = {
  id: 11155111,                                    // Sepolia chain ID
  name: "Sepolia",
  rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/2Iu62gJ3BnNiIFqoPVVE1",  // ✅ FIXED - Use Alchemy URL
  explorerUrl: "https://sepolia.etherscan.io",
};

export default { ADDRESS, ABI, NETWORK };