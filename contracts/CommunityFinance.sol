// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title  CommunityFinance  (v2.1 - Private Groups)
 * @author BlockChit Team
 *
 * NEW IN V2.1:
 *   Public/Private groups  - creators can make groups invite-only
 *   Invite management  - track invited addresses and consume invites on join
 *   getMyInvites()  - fetch private groups you're invited to
 */
contract CommunityFinance is ReentrancyGuard, Pausable {

    // ================================================================
    // CONSTANTS
    // ================================================================

    uint public constant ETH_TO_INR        = 500000;
    uint public constant INTEREST_RATE     = 5;
    uint public constant MONTH             = 1 minutes;
    uint public constant VOTE_WINDOW       = 5 minutes;
    uint public constant EMERGENCY_WINDOW  = 5 minutes;
    uint public constant KICK_WINDOW       = 5 minutes;
    uint public constant LATE_FEE_PER_DAY  = 2;
    uint public constant EMERGENCY_CAP_PCT = 50;
    uint public constant EMERGENCY_EXTRA   = 3;
    uint public constant MIN_SIZE          = 2;
    uint public constant MAX_SIZE          = 40;
    uint public constant FILL_DEADLINE     = 7 days;
    uint public constant CREDIT_ON_TIME    = 10;
    uint public constant CREDIT_LATE       = 5;
    uint public constant CREDIT_DEFAULT    = 20;
    uint public constant MISS_LIMIT        = 2;

    // ================================================================
    // ENUMS
    // ================================================================

    enum GroupStatus  { PENDING, OPEN, ACTIVE, CLOSED }
    enum VoteState    { NONE, OPEN, RESOLVED }

    // ================================================================
    // STRUCTS
    // ================================================================

    struct Loan {
        uint    principal;
        uint    monthlyInterest;
        uint    monthlyPrincipal;
        uint    monthsPaid;
        uint    lastPaymentTime;
        uint    nextDueTime;
        bool    active;
    }

    struct VoteRound {
        VoteState state;
        uint      endTime;
        uint      totalCast;
        address   winner;
        bool      wasTie;
    }

    struct EmergencyRequest {
        uint    id;
        address requester;
        uint    amount;
        string  reason;
        uint    endTime;
        uint    yesVotes;
        uint    noVotes;
        bool    resolved;
        bool    approved;
        bool    repaid;
        uint    repayBy;
    }

    struct KickRequest {
        uint    id;
        address target;
        address raisedBy;
        uint    endTime;
        uint    yesVotes;
        uint    noVotes;
        bool    resolved;
        bool    approved;
    }

    struct MemberInfo {
        address wallet;
        uint    creditScore;
        uint    missedEMIs;
        uint    onTimeEMIs;
        uint    lateEMIs;
        bool    active;
    }

    struct Group {
        uint        id;
        string      name;
        address     creator;
        GroupStatus status;
        uint        contribution;
        uint        maxSize;
        uint        tenure;
        uint        fillDeadline;
        address[]   members;
        address     borrower;
        Loan        loan;
        VoteRound   voteRound;
        uint        emergencyCount;
        uint        kickCount;
        uint        totalPool;
        uint        profitPool;
        bool        isPrivate;  // NEW: Public vs Private flag
    }

    // ================================================================
    // STATE VARIABLES
    // ================================================================

    address public admin;
    uint    public groupCount;

    mapping(uint => Group) public groups;
    mapping(uint => mapping(address => uint)) public profitBalance;
    mapping(uint => mapping(address => MemberInfo)) public memberInfo;
    mapping(uint => mapping(uint => mapping(address => bool))) public emiPaid;

    // -- Voting
    mapping(uint => mapping(address => bool)) public hasVoted;
    mapping(uint => mapping(address => uint)) public votesReceived;
    mapping(uint => address[]) private _candidates;

    // -- Emergency
    mapping(uint => mapping(uint => EmergencyRequest)) public emergencyRequests;
    mapping(uint => mapping(uint => mapping(address => bool))) public emergencyVoted;
    mapping(address => uint) public activeEmergencyGroup;

    // -- Kick
    mapping(uint => mapping(uint => KickRequest)) public kickRequests;
    mapping(uint => mapping(uint => mapping(address => bool))) public kickVoted;
    mapping(uint => mapping(address => uint)) public activeKick;

    // -- Membership
    mapping(address => uint) public memberGroup;
    mapping(address => bool) public inGroup;

    // -- NEW: Private group invites
    mapping(uint => mapping(address => bool)) public groupInvites;     // gid => address => invited?
    mapping(uint => address[]) public invitedList;                     // gid => list of invited addresses

    // ================================================================
    // EVENTS
    // ================================================================

    event GroupCreated      (uint indexed gid, address creator, string name, uint contribution, uint maxSize, uint tenure, bool isPrivate);
    event GroupApproved     (uint indexed gid);
    event GroupRejected     (uint indexed gid);
    event GroupClosed       (uint indexed gid, string reason);
    event MemberJoined      (uint indexed gid, address member);
    event VotingStarted     (uint indexed gid, uint endTime);
    event VoteCast          (uint indexed gid, address voter, address candidate);
    event BorrowerSelected  (uint indexed gid, address borrower, bool wasTie);
    event LoanReleased      (uint indexed gid, address borrower, uint amount);
    event EMIPaid           (uint indexed gid, address borrower, uint amount, uint month, uint lateFee);
    event ProfitWithdrawn   (uint indexed gid, address member, uint amount);
    event CreditUpdated     (uint indexed gid, address member, uint newScore);
    event EmergencyRequested(uint indexed gid, uint indexed rid, address requester, uint amount, string reason);
    event EmergencyVoteCast (uint indexed gid, uint indexed rid, address voter, bool support);
    event EmergencyResolved (uint indexed gid, uint indexed rid, bool approved, uint yes, uint no);
    event EmergencyReleased (uint indexed gid, uint indexed rid, address requester, uint amount);
    event EmergencyRepaid   (uint indexed gid, uint indexed rid, address requester, uint amount);
    event KickRaised        (uint indexed gid, uint indexed kid, address target, address raisedBy);
    event KickVoteCast      (uint indexed gid, uint indexed kid, address voter, bool support);
    event KickResolved      (uint indexed gid, uint indexed kid, address target, bool kicked);
    event MemberInvited     (uint indexed gid, address indexed invitee);
    event InviteRevoked     (uint indexed gid, address indexed invitee);

    // ================================================================
    // MODIFIERS
    // ================================================================

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier onlyMemberOf(uint gid) {
        require(_isMember(gid, msg.sender), "Not a member of this group");
        _;
    }

    modifier groupExists(uint gid) {
        require(gid > 0 && gid <= groupCount, "Group does not exist");
        _;
    }

    modifier inStatus(uint gid, GroupStatus s) {
        require(groups[gid].status == s, "Wrong group status");
        _;
    }

    // ================================================================
    // CONSTRUCTOR
    // ================================================================

    constructor() {
        admin = msg.sender;
    }

    // ================================================================
    // SECTION 1 - ADMIN CONTROLS
    // ================================================================

    function approveGroup(uint gid)
        external onlyAdmin groupExists(gid)
    {
        require(groups[gid].status == GroupStatus.PENDING, "Not pending");
        groups[gid].status       = GroupStatus.OPEN;
        groups[gid].fillDeadline = block.timestamp + FILL_DEADLINE;
        emit GroupApproved(gid);
    }

    function rejectGroup(uint gid)
        external onlyAdmin groupExists(gid) nonReentrant
    {
        Group storage g = groups[gid];
        require(g.status == GroupStatus.PENDING, "Not pending");
        g.status = GroupStatus.CLOSED;

        inGroup[g.creator]     = false;
        memberGroup[g.creator] = 0;

        uint refund = g.contribution;
        (bool ok,) = payable(g.creator).call{value: refund}("");
        require(ok, "Refund failed");

        emit GroupRejected(gid);
    }

    function pause()   external onlyAdmin { _pause(); }
    function unpause() external onlyAdmin { _unpause(); }

    // ================================================================
    // SECTION 2 - GROUP MANAGEMENT (UPDATED)
    // ================================================================

    /**
     * @notice Create a new group (public or private).
     * @param name        Display name
     * @param maxSize     Number of members (2-40)
     * @param tenure      Repayment months (1-24)
     * @param isPrivate   true for invite-only, false for open to all
     * @param invites     Array of wallet addresses to invite (only if isPrivate=true)
     */
    function createGroup(
        string calldata name,
        uint maxSize,
        uint tenure,
        bool isPrivate,
        address[] calldata invites
    ) external payable whenNotPaused {
        require(!inGroup[msg.sender],          "Leave current group first");
        require(bytes(name).length > 0,        "Name cannot be empty");
        require(maxSize >= MIN_SIZE,            "Minimum 2 members");
        require(maxSize <= MAX_SIZE,            "Maximum 40 members");
        require(tenure >= 1 && tenure <= 24,   "Tenure: 1 to 24 months");
        require(msg.value > 0,                 "Contribution must be > 0");

        // NEW: Validate private group invites
        if (isPrivate) {
            require(invites.length > 0, "Private groups must have at least one invite");
            for (uint i = 0; i < invites.length; i++) {
                require(invites[i] != address(0), "Invalid invite address");
                require(invites[i] != msg.sender, "Cannot invite yourself");
            }
        }

        groupCount++;
        uint gid = groupCount;

        Group storage g = groups[gid];
        g.id           = gid;
        g.name         = name;
        g.creator      = msg.sender;
        g.status       = GroupStatus.PENDING;
        g.contribution = msg.value;
        g.maxSize      = maxSize;
        g.tenure       = tenure;
        g.totalPool    = msg.value;
        g.isPrivate    = isPrivate;  // NEW
        g.members.push(msg.sender);

        memberGroup[msg.sender] = gid;
        inGroup[msg.sender]     = true;

        memberInfo[gid][msg.sender] = MemberInfo({
            wallet:      msg.sender,
            creditScore: 100,
            missedEMIs:  0,
            onTimeEMIs:  0,
            lateEMIs:    0,
            active:      true
        });

        // NEW: Store invites if private
        if (isPrivate) {
            for (uint i = 0; i < invites.length; i++) {
                groupInvites[gid][invites[i]] = true;
                invitedList[gid].push(invites[i]);
            }
            // Creator is always invited (already a member)
            groupInvites[gid][msg.sender] = true;
        }

        emit GroupCreated(gid, msg.sender, name, msg.value, maxSize, tenure, isPrivate);
    }

    /**
     * @notice Join an open group. For private groups, user must be invited.
     */
    function joinGroup(uint gid)
        external payable
        whenNotPaused
        groupExists(gid)
        inStatus(gid, GroupStatus.OPEN)
        nonReentrant
    {
        Group storage g = groups[gid];

        require(!inGroup[msg.sender],            "Already in a group");
        require(g.members.length < g.maxSize,    "Group is full");
        require(msg.value == g.contribution,     "Wrong ETH amount");
        require(block.timestamp <= g.fillDeadline, "Group fill deadline passed");

        // NEW: Check if invited (for private groups)
        if (g.isPrivate) {
            require(groupInvites[gid][msg.sender], "Not invited to this private group");
            groupInvites[gid][msg.sender] = false;  // Consume invite
        }

        g.members.push(msg.sender);
        g.totalPool    += msg.value;
        memberGroup[msg.sender] = gid;
        inGroup[msg.sender]     = true;

        memberInfo[gid][msg.sender] = MemberInfo({
            wallet:      msg.sender,
            creditScore: 100,
            missedEMIs:  0,
            onTimeEMIs:  0,
            lateEMIs:    0,
            active:      true
        });

        emit MemberJoined(gid, msg.sender);
    }

    function expireGroup(uint gid)
        external
        whenNotPaused
        groupExists(gid)
        inStatus(gid, GroupStatus.OPEN)
        nonReentrant
    {
        Group storage g = groups[gid];
        require(block.timestamp > g.fillDeadline,       "Deadline not passed");
        require(g.members.length < g.maxSize,           "Group is full, cannot expire");

        g.status = GroupStatus.CLOSED;

        for (uint i = 0; i < g.members.length; i++) {
            address m = g.members[i];
            inGroup[m]     = false;
            memberGroup[m] = 0;
            (bool ok,) = payable(m).call{value: g.contribution}("");
            require(ok, "Refund failed");
        }

        emit GroupClosed(gid, "Expired: not filled in time");
    }

    // ================================================================
    // SECTION 2.1 - INVITE MANAGEMENT (NEW)
    // ================================================================

    /**
     * @notice Creator invites additional members after group creation (private groups only).
     */
    function inviteMember(uint gid, address invitee)
        external whenNotPaused groupExists(gid)
    {
        Group storage g = groups[gid];
        require(msg.sender == g.creator,         "Only creator can invite");
        require(g.isPrivate,                     "Group is public");
        require(!groupInvites[gid][invitee],     "Already invited");
        require(invitee != address(0),           "Invalid address");
        require(invitee != msg.sender,           "Cannot invite yourself");
        require(
            g.status == GroupStatus.OPEN || g.status == GroupStatus.PENDING,
            "Group not open for invites"
        );

        groupInvites[gid][invitee] = true;
        invitedList[gid].push(invitee);
        emit MemberInvited(gid, invitee);
    }

    /**
     * @notice Creator revokes a pending invite (only before the invitee joins).
     */
    function revokeInvite(uint gid, address invitee)
        external whenNotPaused groupExists(gid)
    {
        require(msg.sender == groups[gid].creator, "Only creator can revoke");
        require(groupInvites[gid][invitee],        "Not invited");

        groupInvites[gid][invitee] = false;
        emit InviteRevoked(gid, invitee);
    }

    /**
     * @notice Returns the full invite list for a group (useful for creator dashboard).
     */
    function getInvitedList(uint gid)
        external view returns (address[] memory)
    {
        return invitedList[gid];
    }

    // ================================================================
    // SECTION 3 - VOTING
    // ================================================================

    function startVoting(uint gid)
        external
        whenNotPaused
        groupExists(gid)
        onlyMemberOf(gid)
    {
        Group storage g = groups[gid];
        require(g.members.length == g.maxSize,        "Group not full yet");
        require(g.borrower == address(0),             "Borrower already chosen");
        require(g.voteRound.state == VoteState.NONE,  "Vote already started");
        require(!g.loan.active,                       "Loan already active");

        for (uint i = 0; i < g.members.length; i++) {
            hasVoted[gid][g.members[i]]      = false;
            votesReceived[gid][g.members[i]] = 0;
        }
        delete _candidates[gid];

        g.voteRound.state    = VoteState.OPEN;
        g.voteRound.endTime  = block.timestamp + VOTE_WINDOW;
        g.voteRound.totalCast = 0;
        g.status             = GroupStatus.ACTIVE;

        emit VotingStarted(gid, g.voteRound.endTime);
    }

    function castVote(uint gid, address candidate)
        external
        whenNotPaused
        groupExists(gid)
        onlyMemberOf(gid)
    {
        Group storage g = groups[gid];

        require(g.voteRound.state == VoteState.OPEN,    "No active vote");
        require(block.timestamp <= g.voteRound.endTime, "Voting window closed");
        require(!hasVoted[gid][msg.sender],             "Already voted");
        require(candidate != msg.sender,                "Cannot vote for yourself");
        require(_isMember(gid, candidate),              "Candidate not in group");

        if (votesReceived[gid][candidate] == 0) {
            _candidates[gid].push(candidate);
        }

        hasVoted[gid][msg.sender]       = true;
        votesReceived[gid][candidate]++;
        g.voteRound.totalCast++;

        emit VoteCast(gid, msg.sender, candidate);
    }

    function resolveVote(uint gid)
        external
        whenNotPaused
        groupExists(gid)
        onlyMemberOf(gid)
    {
        Group storage g = groups[gid];

        require(g.voteRound.state == VoteState.OPEN, "No open vote");
        require(
            block.timestamp > g.voteRound.endTime ||
            g.voteRound.totalCast == g.members.length,
            "Vote still in progress"
        );

        address winner;
        bool wasTie = false;

        if (g.voteRound.totalCast == 0) {
            winner = g.members[0];
        } else {
            uint maxVotes = 0;
            for (uint i = 0; i < _candidates[gid].length; i++) {
                if (votesReceived[gid][_candidates[gid][i]] > maxVotes) {
                    maxVotes = votesReceived[gid][_candidates[gid][i]];
                }
            }

            address[] memory tied = new address[](_candidates[gid].length);
            uint tieCount = 0;
            for (uint i = 0; i < _candidates[gid].length; i++) {
                if (votesReceived[gid][_candidates[gid][i]] == maxVotes) {
                    tied[tieCount++] = _candidates[gid][i];
                }
            }

            if (tieCount == 1) {
                winner = tied[0];
            } else {
                wasTie = true;
                uint rand = uint(keccak256(abi.encodePacked(
                    blockhash(block.number - 1),
                    block.timestamp,
                    g.voteRound.totalCast,
                    gid
                ))) % tieCount;
                winner = tied[rand];
            }
        }

        g.borrower            = winner;
        g.voteRound.state     = VoteState.RESOLVED;
        g.voteRound.winner    = winner;
        g.voteRound.wasTie    = wasTie;

        emit BorrowerSelected(gid, winner, wasTie);
    }

    // ================================================================
    // SECTION 4 - LOAN & EMI
    // ================================================================

    function releaseFunds(uint gid)
        external
        whenNotPaused
        groupExists(gid)
        onlyMemberOf(gid)
        nonReentrant
    {
        Group storage g = groups[gid];

        require(!g.loan.active,           "Loan already active");
        require(g.borrower != address(0), "Borrower not selected");

        uint principal        = g.totalPool;
        uint monthlyInterest  = (principal * INTEREST_RATE) / 100;
        uint monthlyPrincipal = principal / g.tenure;

        g.loan = Loan({
            principal:        principal,
            monthlyInterest:  monthlyInterest,
            monthlyPrincipal: monthlyPrincipal,
            monthsPaid:       0,
            lastPaymentTime:  block.timestamp,
            nextDueTime:      block.timestamp + MONTH,
            active:           true
        });

        g.totalPool = 0;

        (bool ok,) = payable(g.borrower).call{value: principal}("");
        require(ok, "Fund transfer failed");

        emit LoanReleased(gid, g.borrower, principal);
    }

    function payEMI(uint gid)
        external payable
        whenNotPaused
        groupExists(gid)
        nonReentrant
    {
        Group storage g = groups[gid];

        require(msg.sender == g.borrower,          "Not the borrower");
        require(g.loan.active,                     "No active loan");
        require(g.loan.monthsPaid < g.tenure,      "Loan fully repaid");

        uint baseEMI  = g.loan.monthlyPrincipal + g.loan.monthlyInterest;
        uint lateFee  = 0;
        bool onTime   = true;

        if (block.timestamp > g.loan.nextDueTime) {
            uint daysLate = (block.timestamp - g.loan.nextDueTime) / 60;
            lateFee = (baseEMI * LATE_FEE_PER_DAY * daysLate) / 100;
            onTime  = false;
        }

        uint totalDue = baseEMI + lateFee;
        require(msg.value == totalDue, "Incorrect EMI amount");

        uint totalProfit     = g.loan.monthlyInterest + lateFee;
        uint perMemberProfit = totalProfit / g.members.length;

        for (uint i = 0; i < g.members.length; i++) {
            profitBalance[gid][g.members[i]] += perMemberProfit;
        }

        g.profitPool           += totalProfit;
        g.loan.monthsPaid++;
        g.loan.lastPaymentTime  = block.timestamp;
        g.loan.nextDueTime      = block.timestamp + MONTH;

        MemberInfo storage info = memberInfo[gid][g.borrower];
        if (onTime) {
            info.onTimeEMIs++;
            info.creditScore += CREDIT_ON_TIME;
        } else {
            info.lateEMIs++;
            if (info.creditScore >= CREDIT_LATE) {
                info.creditScore -= CREDIT_LATE;
            } else {
                info.creditScore = 0;
            }
        }

        emit EMIPaid(gid, msg.sender, baseEMI, g.loan.monthsPaid, lateFee);
        emit CreditUpdated(gid, g.borrower, info.creditScore);

        if (g.loan.monthsPaid == g.tenure) {
            g.loan.active = false;
            g.borrower    = address(0);
            g.voteRound.state = VoteState.NONE;
        }
    }

    // ================================================================
    // SECTION 5 - PROFIT WITHDRAWAL
    // ================================================================

    function withdrawAllProfit(uint gid)
        external
        whenNotPaused
        groupExists(gid)
        onlyMemberOf(gid)
        nonReentrant
    {
        uint amount = profitBalance[gid][msg.sender];
        require(amount > 0, "No profit to withdraw");

        profitBalance[gid][msg.sender]  = 0;
        groups[gid].profitPool         -= amount;

        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "Transfer failed");

        emit ProfitWithdrawn(gid, msg.sender, amount);
    }

    function withdrawPartialProfit(uint gid, uint amount)
        external
        whenNotPaused
        groupExists(gid)
        onlyMemberOf(gid)
        nonReentrant
    {
        require(amount > 0,                                  "Amount must be > 0");
        require(profitBalance[gid][msg.sender] >= amount,   "Insufficient profit");

        profitBalance[gid][msg.sender]  -= amount;
        groups[gid].profitPool          -= amount;

        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "Transfer failed");

        emit ProfitWithdrawn(gid, msg.sender, amount);
    }

    // ================================================================
    // SECTION 6 - EMERGENCY FUNDING
    // ================================================================

    function raiseEmergency(uint gid, uint amount, string calldata reason)
        external
        whenNotPaused
        groupExists(gid)
        onlyMemberOf(gid)
    {
        Group storage g = groups[gid];

        require(activeEmergencyGroup[msg.sender] == 0,    "Already have active request");
        require(bytes(reason).length > 0,                 "Reason required");
        require(amount > 0,                               "Amount must be > 0");

        uint maxAllowed = (address(this).balance * EMERGENCY_CAP_PCT) / 100;
        require(amount <= maxAllowed,                     "Exceeds 50% of pool balance");

        g.emergencyCount++;
        uint rid = g.emergencyCount;

        emergencyRequests[gid][rid] = EmergencyRequest({
            id:        rid,
            requester: msg.sender,
            amount:    amount,
            reason:    reason,
            endTime:   block.timestamp + EMERGENCY_WINDOW,
            yesVotes:  0,
            noVotes:   0,
            resolved:  false,
            approved:  false,
            repaid:    false,
            repayBy:   0
        });

        activeEmergencyGroup[msg.sender] = gid;

        emit EmergencyRequested(gid, rid, msg.sender, amount, reason);
    }

    function voteEmergency(uint gid, uint rid, bool support)
        external
        whenNotPaused
        groupExists(gid)
        onlyMemberOf(gid)
    {
        EmergencyRequest storage req = emergencyRequests[gid][rid];

        require(!req.resolved,                             "Already resolved");
        require(block.timestamp <= req.endTime,            "Voting window closed");
        require(!emergencyVoted[gid][rid][msg.sender],     "Already voted");
        require(msg.sender != req.requester,               "Requester cannot vote");

        emergencyVoted[gid][rid][msg.sender] = true;

        if (support) { req.yesVotes++; }
        else          { req.noVotes++;  }

        emit EmergencyVoteCast(gid, rid, msg.sender, support);
    }

    function resolveEmergency(uint gid, uint rid)
        external
        whenNotPaused
        groupExists(gid)
        onlyMemberOf(gid)
        nonReentrant
    {
        Group storage g             = groups[gid];
        EmergencyRequest storage req = emergencyRequests[gid][rid];

        require(!req.resolved,                        "Already resolved");
        require(block.timestamp > req.endTime,        "Vote still open");

        uint majority = g.members.length / 2 + 1;
        bool approved = req.yesVotes >= majority;

        req.resolved = true;
        req.approved = approved;

        emit EmergencyResolved(gid, rid, approved, req.yesVotes, req.noVotes);

        if (approved) {
            require(address(this).balance >= req.amount, "Insufficient contract balance");
            req.repayBy = block.timestamp + (g.tenure * MONTH);

            (bool ok,) = payable(req.requester).call{value: req.amount}("");
            require(ok, "Emergency transfer failed");

            emit EmergencyReleased(gid, rid, req.requester, req.amount);
        } else {
            activeEmergencyGroup[req.requester] = 0;
        }
    }

    function repayEmergency(uint gid, uint rid)
        external payable
        whenNotPaused
        groupExists(gid)
        nonReentrant
    {
        EmergencyRequest storage req = emergencyRequests[gid][rid];
        Group storage g              = groups[gid];

        require(msg.sender == req.requester,  "Not the requester");
        require(req.approved,                 "Request was not approved");
        require(!req.repaid,                  "Already repaid");

        uint interest  = (req.amount * EMERGENCY_EXTRA) / 100;
        uint totalDue  = req.amount + interest;
        require(msg.value == totalDue, "Incorrect repayment amount");

        req.repaid                          = true;
        activeEmergencyGroup[msg.sender]    = 0;

        uint perMember = interest / g.members.length;
        for (uint i = 0; i < g.members.length; i++) {
            profitBalance[gid][g.members[i]] += perMember;
        }
        g.profitPool += interest;

        emit EmergencyRepaid(gid, rid, msg.sender, totalDue);
    }

    // ================================================================
    // SECTION 7 - KICK DEFAULTER
    // ================================================================

    function raiseKick(uint gid, address target)
        external
        whenNotPaused
        groupExists(gid)
        onlyMemberOf(gid)
    {
        Group storage g = groups[gid];

        require(target != msg.sender,                        "Cannot kick yourself");
        require(_isMember(gid, target),                      "Target not in group");
        require(memberInfo[gid][target].missedEMIs >= MISS_LIMIT, "Not enough missed EMIs");
        require(activeKick[gid][target] == 0,               "Kick already in progress");

        g.kickCount++;
        uint kid = g.kickCount;

        kickRequests[gid][kid] = KickRequest({
            id:       kid,
            target:   target,
            raisedBy: msg.sender,
            endTime:  block.timestamp + KICK_WINDOW,
            yesVotes: 0,
            noVotes:  0,
            resolved: false,
            approved: false
        });

        activeKick[gid][target] = kid;

        emit KickRaised(gid, kid, target, msg.sender);
    }

    function voteKick(uint gid, uint kid, bool support)
        external
        whenNotPaused
        groupExists(gid)
        onlyMemberOf(gid)
    {
        KickRequest storage req = kickRequests[gid][kid];

        require(!req.resolved,                          "Already resolved");
        require(block.timestamp <= req.endTime,         "Window closed");
        require(!kickVoted[gid][kid][msg.sender],       "Already voted");
        require(msg.sender != req.target,               "Target cannot vote");

        kickVoted[gid][kid][msg.sender] = true;
        if (support) { req.yesVotes++; }
        else          { req.noVotes++;  }

        emit KickVoteCast(gid, kid, msg.sender, support);
    }

    function resolveKick(uint gid, uint kid)
        external
        whenNotPaused
        groupExists(gid)
        onlyMemberOf(gid)
        nonReentrant
    {
        Group storage g         = groups[gid];
        KickRequest storage req = kickRequests[gid][kid];

        require(!req.resolved,                  "Already resolved");
        require(block.timestamp > req.endTime,  "Vote still open");

        uint majority = g.members.length / 2 + 1;
        bool approved = req.yesVotes >= majority;

        req.resolved = true;
        req.approved = approved;

        if (approved) {
            address target = req.target;

            _removeMember(gid, target);

            inGroup[target]     = false;
            memberGroup[target] = 0;
            memberInfo[gid][target].active = false;
            activeKick[gid][target]        = 0;

            uint share = g.contribution / g.members.length;
            for (uint i = 0; i < g.members.length; i++) {
                profitBalance[gid][g.members[i]] += share;
            }
        } else {
            activeKick[gid][req.target] = 0;
        }

        emit KickResolved(gid, kid, req.target, approved);
    }

    // ================================================================
    // SECTION 8 - VIEW FUNCTIONS (UPDATED)
    // ================================================================

    function getMembers(uint gid) external view returns (address[] memory) {
        return groups[gid].members;
    }

    function getGroupCount() external view returns (uint) {
        return groupCount;
    }

    /**
     * @notice FIX: Returns uint[] (group IDs only) instead of Group[].
     *         ethers.js cannot decode Group[] containing nested structs.
     */
    function getMyInvites(address user) external view returns (uint[] memory) {
        uint count = 0;
        for (uint i = 1; i <= groupCount; i++) {
            if (groups[i].isPrivate &&
                groupInvites[i][user] &&
                groups[i].status == GroupStatus.OPEN) {
                count++;
            }
        }
        uint[] memory result = new uint[](count);
        uint idx = 0;
        for (uint i = 1; i <= groupCount; i++) {
            if (groups[i].isPrivate &&
                groupInvites[i][user] &&
                groups[i].status == GroupStatus.OPEN) {
                result[idx++] = i;
            }
        }
        return result;
    }

    /**
     * @notice FIX: Returns only PUBLIC open groups.
     *         Private groups are hidden from the discovery page.
     */
    function getOpenGroups() external view returns (uint[] memory) {
        uint count = 0;
        for (uint i = 1; i <= groupCount; i++) {
            if (groups[i].status == GroupStatus.OPEN && !groups[i].isPrivate) count++;
        }
        uint[] memory result = new uint[](count);
        uint idx = 0;
        for (uint i = 1; i <= groupCount; i++) {
            if (groups[i].status == GroupStatus.OPEN && !groups[i].isPrivate) result[idx++] = i;
        }
        return result;
    }

    function getPendingGroups() external view returns (uint[] memory) {
        uint count = 0;
        for (uint i = 1; i <= groupCount; i++) {
            if (groups[i].status == GroupStatus.PENDING) count++;
        }
        uint[] memory result = new uint[](count);
        uint idx = 0;
        for (uint i = 1; i <= groupCount; i++) {
            if (groups[i].status == GroupStatus.PENDING) result[idx++] = i;
        }
        return result;
    }

    function getEMI(uint gid) external view returns (uint) {
        Loan memory l = groups[gid].loan;
        return l.monthlyPrincipal + l.monthlyInterest;
    }

    function getLateFee(uint gid) external view returns (uint) {
        Loan memory l = groups[gid].loan;
        if (!l.active || block.timestamp <= l.nextDueTime) return 0;
        uint daysLate = (block.timestamp - l.nextDueTime) / 60;
        uint base     = l.monthlyPrincipal + l.monthlyInterest;
        return (base * LATE_FEE_PER_DAY * daysLate) / 100;
    }

    function getNextDueTime(uint gid) external view returns (uint) {
        return groups[gid].loan.nextDueTime;
    }

    function getRemainingMonths(uint gid) external view returns (uint) {
        Group memory g = groups[gid];
        if (g.loan.monthsPaid >= g.tenure) return 0;
        return g.tenure - g.loan.monthsPaid;
    }

    function getPoolBalance(uint gid) external view returns (uint) {
        return groups[gid].totalPool;
    }

    function getCreditScore(uint gid, address member) external view returns (uint) {
        return memberInfo[gid][member].creditScore;
    }

    function getMemberInfo(uint gid, address member)
        external view
        returns (uint creditScore, uint missed, uint onTime, uint late)
    {
        MemberInfo memory info = memberInfo[gid][member];
        return (info.creditScore, info.missedEMIs, info.onTimeEMIs, info.lateEMIs);
    }

    function getVoteCount(uint gid, address candidate) external view returns (uint) {
        return votesReceived[gid][candidate];
    }

    function getProfitBalance(uint gid, address member) external view returns (uint) {
        return profitBalance[gid][member];
    }

    function ethToINR(uint ethAmount) public pure returns (uint) {
        return (ethAmount * ETH_TO_INR) / 1 ether;
    }

    function getEMIinINR(uint gid) external view returns (uint) {
        Loan memory l = groups[gid].loan;
        return ethToINR(l.monthlyPrincipal + l.monthlyInterest);
    }

    function getPoolInINR(uint gid) external view returns (uint) {
        return ethToINR(groups[gid].totalPool);
    }

    // ================================================================
    // SECTION 9 - INTERNAL HELPERS
    // ================================================================

    function _isMember(uint gid, address addr) internal view returns (bool) {
        address[] memory mems = groups[gid].members;
        for (uint i = 0; i < mems.length; i++) {
            if (mems[i] == addr) return true;
        }
        return false;
    }

    function _removeMember(uint gid, address target) internal {
        address[] storage mems = groups[gid].members;
        for (uint i = 0; i < mems.length; i++) {
            if (mems[i] == target) {
                mems[i] = mems[mems.length - 1];
                mems.pop();
                break;
            }
        }
    }

    // ================================================================
    // FALLBACK
    // ================================================================
    receive() external payable {}
}
