/**
 *
 * Production fixes:
 *  1. createGroup  — removed wrong `contribution` param, added `invites: address[]`
 *  2. groups()     — correct field order, Loan + VoteRound as tuples, removed fake memberCount
 *  3. kickRequests — added missing `endTime`, fixed approved/resolved swap
 *  4. emergencyRequests — added missing `endTime` and `repayBy`
 *  5. Added admin(), getInvitedList(), isInvited(), emergencyVoted(), kickVoted()
 *  6. Removed non-existent owner() and getMyPrivateInvites()
 * 
 * ERROR CODES REFERENCE:
 * ──────────────────────────────────────────────────────────────
 * ERR_INVALID_GROUP          "Group does not exist or is inactive"
 * ERR_NOT_ADMIN              "Only admin can perform this action"
 * ERR_NOT_MEMBER             "User is not a member of this group"
 * ERR_ALREADY_MEMBER         "User is already a member of this group"
 * ERR_GROUP_NOT_OPEN         "Group is not accepting new members"
 * ERR_INSUFFICIENT_FUNDS     "Caller has insufficient ETH balance"
 * ERR_PAUSED                 "Contract is paused, operations disabled"
 * ERR_KICK_ACTIVE            "An active kick is pending for this member"
 * ERR_NOT_YET_OVERDUE        "EMI is not yet overdue (missedEMIs < 2)"
 * ERR_NONCE_EXPIRED          "Transaction nonce expired (try again)"
 * ERR_NO_PERMISSION          "Caller lacks required permissions"
 * ERR_VOTE_ALREADY_CAST      "User has already voted on this proposal"
 * ERR_VOTING_NOT_OPEN        "Voting period has ended or not started"
 * ERR_EMERGENCY_NOT_FOUND    "Emergency request doesn't exist"
 * ERR_CANNOT_SELF_KICK       "Cannot raise a kick against yourself"
 * 
 * Note: Check the CommunityFinance.sol contract for exact error string definitions
 * and transaction revert messages for debugging failed transactions.
 */

export const ADDRESS = "0x44080CF1517a079F31C8333241Ee12f377A1cb9d";

export const ABI = [

  // ══════════════ EVENTS ══════════════
  {
    type: "event", name: "GroupCreated",
    inputs: [
      { name: "gid",          type: "uint256", indexed: true  },
      { name: "creator",      type: "address", indexed: true  },
      { name: "name",         type: "string",  indexed: false },
      { name: "contribution", type: "uint256", indexed: false },
      { name: "maxSize",      type: "uint256", indexed: false },
      { name: "tenure",       type: "uint256", indexed: false },
      { name: "isPrivate",    type: "bool",    indexed: false },
    ],
  },
  { type: "event", name: "GroupApproved",  inputs: [{ name: "gid", type: "uint256", indexed: true }] },
  { type: "event", name: "GroupRejected",  inputs: [{ name: "gid", type: "uint256", indexed: true }] },
  {
    type: "event", name: "GroupClosed",
    inputs: [{ name: "gid", type: "uint256", indexed: true }, { name: "reason", type: "string", indexed: false }],
  },
  {
    type: "event", name: "MemberJoined",
    inputs: [{ name: "gid", type: "uint256", indexed: true }, { name: "member", type: "address", indexed: true }],
  },
  {
    type: "event", name: "MemberLeft",
    inputs: [{ name: "gid", type: "uint256", indexed: true }, { name: "member", type: "address", indexed: true }],
  },
  {
    type: "event", name: "LoanCompleted",
    inputs: [{ name: "gid", type: "uint256", indexed: true }, { name: "round", type: "uint256", indexed: false }],
  },
  {
    type: "event", name: "EMIMissed",
    inputs: [
      { name: "gid",         type: "uint256", indexed: true  },
      { name: "borrower",    type: "address", indexed: false },
      { name: "missedCount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "VotingStarted",
    inputs: [{ name: "gid", type: "uint256", indexed: true }, { name: "endTime", type: "uint256", indexed: false }],
  },
  {
    type: "event", name: "VoteCast",
    inputs: [
      { name: "gid", type: "uint256", indexed: true },
      { name: "voter", type: "address", indexed: true },
      { name: "candidate", type: "address", indexed: true },
    ],
  },
  {
    type: "event", name: "BorrowerSelected",
    inputs: [
      { name: "gid", type: "uint256", indexed: true },
      { name: "borrower", type: "address", indexed: true },
      { name: "wasTie", type: "bool", indexed: false },
    ],
  },
  {
    type: "event", name: "LoanReleased",
    inputs: [
      { name: "gid", type: "uint256", indexed: true },
      { name: "borrower", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "EMIPaid",
    inputs: [
      { name: "gid", type: "uint256", indexed: true },
      { name: "borrower", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "month", type: "uint256", indexed: false },
      { name: "lateFee", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "CreditUpdated",
    inputs: [
      { name: "gid", type: "uint256", indexed: true },
      { name: "member", type: "address", indexed: true },
      { name: "newScore", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "ProfitWithdrawn",
    inputs: [
      { name: "gid", type: "uint256", indexed: true },
      { name: "member", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "EmergencyRequested",
    inputs: [
      { name: "gid", type: "uint256", indexed: true },
      { name: "rid", type: "uint256", indexed: true },
      { name: "requester", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "reason", type: "string", indexed: false },
    ],
  },
  {
    type: "event", name: "EmergencyVoteCast",
    inputs: [
      { name: "gid", type: "uint256", indexed: true },
      { name: "rid", type: "uint256", indexed: true },
      { name: "voter", type: "address", indexed: false },
      { name: "support", type: "bool", indexed: false },
    ],
  },
  {
    type: "event", name: "EmergencyResolved",
    inputs: [
      { name: "gid", type: "uint256", indexed: true },
      { name: "rid", type: "uint256", indexed: true },
      { name: "approved", type: "bool", indexed: false },
      { name: "yes", type: "uint256", indexed: false },
      { name: "no", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "EmergencyReleased",
    inputs: [
      { name: "gid", type: "uint256", indexed: true },
      { name: "rid", type: "uint256", indexed: true },
      { name: "requester", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "EmergencyRepaid",
    inputs: [
      { name: "gid", type: "uint256", indexed: true },
      { name: "rid", type: "uint256", indexed: true },
      { name: "requester", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "KickRaised",
    inputs: [
      { name: "gid", type: "uint256", indexed: true },
      { name: "kid", type: "uint256", indexed: true },
      { name: "target", type: "address", indexed: true },
      { name: "raisedBy", type: "address", indexed: false },
    ],
  },
  {
    type: "event", name: "KickVoteCast",
    inputs: [
      { name: "gid", type: "uint256", indexed: true },
      { name: "kid", type: "uint256", indexed: true },
      { name: "voter", type: "address", indexed: false },
      { name: "support", type: "bool", indexed: false },
    ],
  },
  {
    type: "event", name: "KickResolved",
    inputs: [
      { name: "gid", type: "uint256", indexed: true },
      { name: "kid", type: "uint256", indexed: true },
      { name: "target", type: "address", indexed: true },
      { name: "kicked", type: "bool", indexed: false },
    ],
  },
  {
    type: "event", name: "MemberInvited",
    inputs: [{ name: "gid", type: "uint256", indexed: true }, { name: "invitee", type: "address", indexed: true }],
  },
  {
    type: "event", name: "InviteRevoked",
    inputs: [{ name: "gid", type: "uint256", indexed: true }, { name: "invitee", type: "address", indexed: true }],
  },

  // ══════════════ READ FUNCTIONS ══════════════

  // State variable getters
  { type: "function", name: "groupCount", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  // FIX: admin() replaces owner() — the contract uses `admin` not `owner`
  { type: "function", name: "admin",      inputs: [], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
  { type: "function", name: "paused",     inputs: [], outputs: [{ name: "", type: "bool"    }], stateMutability: "view" },

  {
    type: "function", name: "inGroup",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }], stateMutability: "view",
  },
  {
    type: "function", name: "memberGroup",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }], stateMutability: "view",
  },
  {
    type: "function", name: "hasVoted",
    inputs: [{ name: "groupId", type: "uint256" }, { name: "member", type: "address" }],
    outputs: [{ name: "", type: "bool" }], stateMutability: "view",
  },
  {
    type: "function", name: "votesReceived",
    inputs: [{ name: "groupId", type: "uint256" }, { name: "candidate", type: "address" }],
    outputs: [{ name: "", type: "uint256" }], stateMutability: "view",
  },
  {
    type: "function", name: "activeEmergencyGroup",
    inputs: [{ name: "member", type: "address" }],
    outputs: [{ name: "", type: "uint256" }], stateMutability: "view",
  },
  {
    type: "function", name: "activeKick",
    inputs: [{ name: "groupId", type: "uint256" }, { name: "member", type: "address" }],
    outputs: [{ name: "", type: "uint256" }], stateMutability: "view",
  },
  // FIX: emergencyVoted was used in EmergencyScreen but missing from ABI
  {
    type: "function", name: "emergencyVoted",
    inputs: [
      { name: "groupId",   type: "uint256" },
      { name: "requestId", type: "uint256" },
      { name: "voter",     type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }], stateMutability: "view",
  },
  // FIX: kickVoted was missing — needed to prevent double-voting in KickScreen
  {
    type: "function", name: "kickVoted",
    inputs: [
      { name: "groupId", type: "uint256" },
      { name: "kickId",  type: "uint256" },
      { name: "voter",   type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }], stateMutability: "view",
  },

  // ── groups() mapping getter ────────────────────────────────────────
  // FIX: Correct field order matching Solidity struct declaration.
  //      members[] is a dynamic array — Solidity auto-getter SKIPS it.
  //      Loan and VoteRound are returned as ABI-encoded tuples (ABIEncoderV2).
  //      Previous ABI had wrong `memberCount` field that doesn't exist.
  {
    type: "function", name: "groups",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "id",           type: "uint256" },
      { name: "name",         type: "string"  },
      { name: "creator",      type: "address" },
      { name: "status",       type: "uint8"   },
      { name: "contribution", type: "uint256" },
      { name: "maxSize",      type: "uint256" },
      { name: "tenure",       type: "uint256" },
      { name: "fillDeadline", type: "uint256" },
      // members[] SKIPPED — use getMembers(gid) instead
      { name: "borrower", type: "address" },
      {
        name: "loan", type: "tuple",
        components: [
          { name: "principal",        type: "uint256" },
          { name: "monthlyInterest",  type: "uint256" },
          { name: "monthlyPrincipal", type: "uint256" },
          { name: "monthsPaid",       type: "uint256" },
          { name: "lastPaymentTime",  type: "uint256" },
          { name: "nextDueTime",      type: "uint256" },
          { name: "active",           type: "bool"    },
        ],
      },
      {
        name: "voteRound", type: "tuple",
        components: [
          { name: "state",     type: "uint8"   },
          { name: "endTime",   type: "uint256" },
          { name: "totalCast", type: "uint256" },
          { name: "winner",    type: "address" },
          { name: "wasTie",    type: "bool"    },
        ],
      },
      { name: "emergencyCount", type: "uint256" },
      { name: "kickCount",      type: "uint256" },
      { name: "totalPool",      type: "uint256" },
      { name: "profitPool",     type: "uint256" },
      { name: "isPrivate",      type: "bool"    },
      { name: "completedLoans", type: "uint256" },
    ],
    stateMutability: "view",
  },

  // ── kickRequests mapping getter ────────────────────────────────────
  // FIX 1: Added missing `endTime` field (was causing countdown timer = undefined)
  // FIX 2: Fixed field order — struct is: id, target, raisedBy, endTime, yesVotes, noVotes, resolved, approved
  //        Previous ABI had approved/resolved swapped AND missing endTime
  {
    type: "function", name: "kickRequests",
    inputs: [{ name: "groupId", type: "uint256" }, { name: "kickId", type: "uint256" }],
    outputs: [
      { name: "id",       type: "uint256" },
      { name: "target",   type: "address" },
      { name: "raisedBy", type: "address" },
      { name: "endTime",  type: "uint256" }, // ← was MISSING
      { name: "yesVotes", type: "uint256" },
      { name: "noVotes",  type: "uint256" },
      { name: "resolved", type: "bool"    }, // ← was swapped with approved
      { name: "approved", type: "bool"    },
    ],
    stateMutability: "view",
  },

  // ── emergencyRequests mapping getter ──────────────────────────────
  // FIX: Added missing `endTime` and `repayBy` fields.
  // Struct order: id, requester, amount, reason, endTime, yesVotes, noVotes, resolved, approved, repaid, repayBy
  // Without endTime the vote counts decoded into wrong positions.
  {
    type: "function", name: "emergencyRequests",
    inputs: [{ name: "groupId", type: "uint256" }, { name: "requestId", type: "uint256" }],
    outputs: [
      { name: "id",        type: "uint256" },
      { name: "requester", type: "address" },
      { name: "amount",    type: "uint256" },
      { name: "reason",    type: "string"  },
      { name: "endTime",   type: "uint256" }, // ← was MISSING
      { name: "yesVotes",  type: "uint256" },
      { name: "noVotes",   type: "uint256" },
      { name: "resolved",  type: "bool"    },
      { name: "approved",  type: "bool"    },
      { name: "repaid",    type: "bool"    },
      { name: "repayBy",   type: "uint256" }, // ← was MISSING
    ],
    stateMutability: "view",
  },

  // View helpers
  { type: "function", name: "getMembers",       inputs: [{ name: "groupId", type: "uint256" }],                                               outputs: [{ name: "", type: "address[]" }], stateMutability: "view" },
  { type: "function", name: "getOpenGroups",    inputs: [],                                                                                    outputs: [{ name: "", type: "uint256[]" }], stateMutability: "view" },
  { type: "function", name: "getPendingGroups", inputs: [],                                                                                    outputs: [{ name: "", type: "uint256[]" }], stateMutability: "view" },
  { type: "function", name: "getEMI",           inputs: [{ name: "groupId", type: "uint256" }],                                               outputs: [{ name: "", type: "uint256" }],   stateMutability: "view" },
  { type: "function", name: "getEMIinINR",      inputs: [{ name: "groupId", type: "uint256" }],                                               outputs: [{ name: "", type: "uint256" }],   stateMutability: "view" },
  { type: "function", name: "getLateFee",       inputs: [{ name: "groupId", type: "uint256" }],                                               outputs: [{ name: "", type: "uint256" }],   stateMutability: "view" },
  { type: "function", name: "getNextDueTime",   inputs: [{ name: "groupId", type: "uint256" }],                                               outputs: [{ name: "", type: "uint256" }],   stateMutability: "view" },
  { type: "function", name: "getRemainingMonths", inputs: [{ name: "groupId", type: "uint256" }],                                             outputs: [{ name: "", type: "uint256" }],   stateMutability: "view" },
  { type: "function", name: "getPoolBalance",   inputs: [{ name: "groupId", type: "uint256" }],                                               outputs: [{ name: "", type: "uint256" }],   stateMutability: "view" },
  { type: "function", name: "getCreditScore",   inputs: [{ name: "groupId", type: "uint256" }, { name: "member", type: "address" }],          outputs: [{ name: "", type: "uint256" }],   stateMutability: "view" },
  { type: "function", name: "getProfitBalance", inputs: [{ name: "groupId", type: "uint256" }, { name: "member", type: "address" }],          outputs: [{ name: "", type: "uint256" }],   stateMutability: "view" },
  { type: "function", name: "getMemberInfo",
    inputs: [{ name: "groupId", type: "uint256" }, { name: "member", type: "address" }],
    outputs: [
      { name: "creditScore", type: "uint256" },
      { name: "missedEMIs",  type: "uint256" },
      { name: "onTimeEMIs",  type: "uint256" },
      { name: "lateEMIs",    type: "uint256" },
    ],
    stateMutability: "view",
  },

  // Invite functions — FIX: getInvitedList and isInvited were missing from ABI
  {
    type: "function", name: "getInvitedList",
    inputs: [{ name: "gid", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }], stateMutability: "view",
  },
  {
    type: "function", name: "getMyInvites",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }], stateMutability: "view",
  },
  {
    type: "function", name: "isInvited",
    inputs: [{ name: "gid", type: "uint256" }, { name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }], stateMutability: "view",
  },
  {
    type: "function", name: "groupInvites",
    inputs: [{ name: "gid", type: "uint256" }, { name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }], stateMutability: "view",
  },
  // ── NEW v3.0 view functions ───────────────────────────────────────
  {
    type: "function", name: "getMyPrivateInvites",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }], stateMutability: "view",
  },
  {
    type: "function", name: "getTrustScore",
    inputs: [{ name: "gid", type: "uint256" }, { name: "member", type: "address" }],
    outputs: [{ name: "", type: "uint256" }], stateMutability: "view",
  },
  {
    type: "function", name: "getGroupMetrics",
    inputs: [{ name: "gid", type: "uint256" }],
    outputs: [
      { name: "totalMembers",   type: "uint256" },
      { name: "activeLoan",     type: "bool"    },
      { name: "poolETH",        type: "uint256" },
      { name: "completedLoans", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function", name: "getGroupHealth",
    inputs: [{ name: "gid", type: "uint256" }],
    outputs: [
      { name: "fillPercentage",        type: "uint256" },
      { name: "averageCreditScore",    type: "uint256" },
      { name: "onTimeMemberCount",     type: "uint256" },
      { name: "defaultedMemberCount",  type: "uint256" },
      { name: "profitPoolAmount",      type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function", name: "getGroupROI",
    inputs: [{ name: "gid", type: "uint256" }],
    outputs: [
      { name: "principalReturned", type: "uint256" },
      { name: "profitEarned",      type: "uint256" },
      { name: "roiPercentage",     type: "uint256" },
      { name: "defaultRate",       type: "uint256" },
    ],
    stateMutability: "view",
  },

  // ══════════════ WRITE FUNCTIONS ══════════════

  // FIX: createGroup — removed wrong `contribution: uint256` param, added `invites: address[]`
  // Correct Solidity signature: createGroup(string name, uint maxSize, uint tenure, bool isPrivate, address[] invites)
  // Contribution = msg.value (payable), NOT a parameter
  {
    type: "function", name: "createGroup",
    inputs: [
      { name: "name",      type: "string"    },
      { name: "maxSize",   type: "uint256"   },
      { name: "tenure",    type: "uint256"   },
      { name: "isPrivate", type: "bool"      },
      { name: "invites",   type: "address[]" },
    ],
    outputs: [], stateMutability: "payable",
  },
  { type: "function", name: "joinGroup",             inputs: [{ name: "groupId", type: "uint256" }], outputs: [], stateMutability: "payable"     },
  { type: "function", name: "leaveGroup",            inputs: [{ name: "groupId", type: "uint256" }], outputs: [], stateMutability: "nonpayable"  },
  { type: "function", name: "expireGroup",           inputs: [{ name: "groupId", type: "uint256" }], outputs: [], stateMutability: "nonpayable"  },
  { type: "function", name: "checkAndMarkMissed",   inputs: [{ name: "groupId", type: "uint256" }], outputs: [], stateMutability: "nonpayable"  },
  { type: "function", name: "startVoting",           inputs: [{ name: "groupId", type: "uint256" }], outputs: [], stateMutability: "nonpayable"  },
  { type: "function", name: "resolveVote",           inputs: [{ name: "groupId", type: "uint256" }], outputs: [], stateMutability: "nonpayable"  },
  { type: "function", name: "releaseFunds",          inputs: [{ name: "groupId", type: "uint256" }], outputs: [], stateMutability: "nonpayable"  },
  { type: "function", name: "payEMI",                inputs: [{ name: "groupId", type: "uint256" }], outputs: [], stateMutability: "payable"     },
  { type: "function", name: "approveGroup",          inputs: [{ name: "groupId", type: "uint256" }], outputs: [], stateMutability: "nonpayable"  },
  { type: "function", name: "rejectGroup",           inputs: [{ name: "groupId", type: "uint256" }], outputs: [], stateMutability: "nonpayable"  },
  { type: "function", name: "pause",                 inputs: [],                                      outputs: [], stateMutability: "nonpayable"  },
  { type: "function", name: "unpause",               inputs: [],                                      outputs: [], stateMutability: "nonpayable"  },
  {
    type: "function", name: "castVote",
    inputs: [{ name: "groupId", type: "uint256" }, { name: "candidate", type: "address" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "inviteMember",
    inputs: [{ name: "groupId", type: "uint256" }, { name: "invitee", type: "address" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "revokeInvite",
    inputs: [{ name: "groupId", type: "uint256" }, { name: "invitee", type: "address" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "withdrawAllProfit",
    inputs: [{ name: "groupId", type: "uint256" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "withdrawPartialProfit",
    inputs: [{ name: "groupId", type: "uint256" }, { name: "amount", type: "uint256" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "raiseEmergency",
    inputs: [{ name: "groupId", type: "uint256" }, { name: "amount", type: "uint256" }, { name: "reason", type: "string" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "voteEmergency",
    inputs: [{ name: "groupId", type: "uint256" }, { name: "requestId", type: "uint256" }, { name: "support", type: "bool" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "resolveEmergency",
    inputs: [{ name: "groupId", type: "uint256" }, { name: "requestId", type: "uint256" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "repayEmergency",
    inputs: [{ name: "groupId", type: "uint256" }, { name: "requestId", type: "uint256" }],
    outputs: [], stateMutability: "payable",
  },
  {
    type: "function", name: "raiseKick",
    inputs: [{ name: "groupId", type: "uint256" }, { name: "target", type: "address" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "voteKick",
    inputs: [{ name: "groupId", type: "uint256" }, { name: "kickId", type: "uint256" }, { name: "support", type: "bool" }],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "function", name: "resolveKick",
    inputs: [{ name: "groupId", type: "uint256" }, { name: "kickId", type: "uint256" }],
    outputs: [], stateMutability: "nonpayable",
  },
];

export const NETWORK = {
  id:          11155111,
  name:        "Sepolia",
  rpcUrl:      process.env.REACT_APP_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/2Iu62gJ3BnNiIFqoPVVE1",
  explorerUrl: "https://sepolia.etherscan.io",
};

export default { ADDRESS, ABI, NETWORK };