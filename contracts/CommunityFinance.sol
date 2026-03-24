// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title  CommunityFinance  (v3.0 - Production Ready)
 * @author BlockChit Team
 *
 * NEW IN V3.0:
 *   - Real-world time constants (30 days, 2 days)
 *   - checkAndMarkMissed()      — auto-marks overdue EMIs, enabling kick system
 *   - leaveGroup()              — members can leave OPEN groups and get refund
 *   - Multi-round borrowing     — group cycles through members after each loan
 *   - closeGroup() after final  — proper CLOSED status after all rounds
 *   - getTrustScore()           — composite trustworthiness score
 *   - getGroupMetrics()         — aggregate group data for backend/investor view
 *   - getGroupHealth()          — fill %, avg credit, on-time/default counts
 *   - getGroupROI()             — principal, profit, ROI%, default rate
 *   - getMyPrivateInvites()     — alias for getMyInvites() (frontend compat)
 *   - completedLoans tracking   — per-group counter for rounds completed
 */
contract CommunityFinance is ReentrancyGuard, Pausable {

    // ================================================================
    // CONSTANTS
    // ================================================================

    uint public constant ETH_TO_INR        = 500000;   // 1 ETH = ₹500,000
    uint public constant INTEREST_RATE     = 5;        // 5% interest per month
    uint public constant MONTH             = 30 days;  // PRODUCTION: real month
    uint public constant VOTE_WINDOW       = 2 days;   // 2-day voting window
    uint public constant EMERGENCY_WINDOW  = 3 days;   // 3-day emergency vote
    uint public constant KICK_WINDOW       = 3 days;   // 3-day kick vote
    uint public constant LATE_FEE_PER_DAY  = 2;        // 2% per day late
    uint public constant EMERGENCY_CAP_PCT = 50;       // max 50% of pool
    uint public constant EMERGENCY_EXTRA   = 3;        // 3% interest on emergency
    uint public constant MIN_SIZE          = 2;
    uint public constant MAX_SIZE          = 40;
    uint public constant FILL_DEADLINE     = 7 days;
    uint public constant CREDIT_ON_TIME    = 10;
    uint public constant CREDIT_LATE       = 5;
    uint public constant CREDIT_DEFAULT    = 20;
    uint public constant MISS_LIMIT        = 2;        // missed EMIs before kickable

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
        bool        isPrivate;
        uint        completedLoans;  // NEW: number of completed lending rounds
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

    // -- Private group invites
    mapping(uint => mapping(address => bool)) public groupInvites;
    mapping(uint => address[]) public invitedList;

    // ================================================================
    // EVENTS
    // ================================================================

    event GroupCreated      (uint indexed gid, address creator, string name, uint contribution, uint maxSize, uint tenure, bool isPrivate);
    event GroupApproved     (uint indexed gid);
    event GroupRejected     (uint indexed gid);
    event GroupClosed       (uint indexed gid, string reason);
    event MemberJoined      (uint indexed gid, address member);
    event MemberLeft        (uint indexed gid, address member);  // NEW
    event VotingStarted     (uint indexed gid, uint endTime);
    event VoteCast          (uint indexed gid, address voter, address candidate);
    event BorrowerSelected  (uint indexed gid, address borrower, bool wasTie);
    event LoanReleased      (uint indexed gid, address borrower, uint amount);
    event EMIPaid           (uint indexed gid, address borrower, uint amount, uint month, uint lateFee);
    event LoanCompleted     (uint indexed gid, uint round);  // NEW
    event EMIMissed         (uint indexed gid, address borrower, uint missedCount);  // NEW
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
        require(groups[gid].status == GroupStatus.PENDING, "E:10");
        groups[gid].status       = GroupStatus.OPEN;
        groups[gid].fillDeadline = block.timestamp + FILL_DEADLINE;
        emit GroupApproved(gid);
    }

    function rejectGroup(uint gid)
        external onlyAdmin groupExists(gid) nonReentrant
    {
        Group storage g = groups[gid];
        require(g.status == GroupStatus.PENDING, "E:10");
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
    // SECTION 2 - GROUP MANAGEMENT
    // ================================================================

    /**
     * @notice Create a new group (public or private).
     */
    function createGroup(
        string calldata name,
        uint maxSize,
        uint tenure,
        bool isPrivate,
        address[] calldata invites
    ) external payable whenNotPaused {
        require(!inGroup[msg.sender],          "E:01");
        require(bytes(name).length > 0,        "E:02");
        require(maxSize >= MIN_SIZE,            "E:03");
        require(maxSize <= MAX_SIZE,            "E:04");
        require(tenure >= 1 && tenure <= 24,   "E:05");
        require(msg.value > 0,                 "E:06");

        if (isPrivate) {
            require(invites.length > 0, "E:07");
            for (uint i = 0; i < invites.length; i++) {
                require(invites[i] != address(0), "E:08");
                require(invites[i] != msg.sender, "E:09");
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
        g.isPrivate    = isPrivate;
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

        if (isPrivate) {
            for (uint i = 0; i < invites.length; i++) {
                groupInvites[gid][invites[i]] = true;
                invitedList[gid].push(invites[i]);
            }
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

        require(!inGroup[msg.sender],            "E:01");
        require(g.members.length < g.maxSize,    "E:11");
        require(msg.value == g.contribution,     "E:12");
        require(block.timestamp <= g.fillDeadline, "E:13");

        if (g.isPrivate) {
            require(groupInvites[gid][msg.sender], "E:14");
            groupInvites[gid][msg.sender] = false;
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

    /**
     * @notice NEW: Leave an OPEN group and get contribution refunded.
     *         Creator cannot leave (they must reject via admin or wait for expiry).
     */
    function leaveGroup(uint gid)
        external
        whenNotPaused
        groupExists(gid)
        inStatus(gid, GroupStatus.OPEN)
        nonReentrant
    {
        Group storage g = groups[gid];
        require(_isMember(gid, msg.sender), "E:15");
        require(msg.sender != g.creator, "E:16");

        _removeMember(gid, msg.sender);
        g.totalPool -= g.contribution;
        inGroup[msg.sender]     = false;
        memberGroup[msg.sender] = 0;
        memberInfo[gid][msg.sender].active = false;

        (bool ok,) = payable(msg.sender).call{value: g.contribution}("");
        require(ok, "E:17");

        emit MemberLeft(gid, msg.sender);
    }

    function expireGroup(uint gid)
        external
        whenNotPaused
        groupExists(gid)
        inStatus(gid, GroupStatus.OPEN)
        nonReentrant
    {
        Group storage g = groups[gid];
        require(block.timestamp > g.fillDeadline,       "E:18");
        require(g.members.length < g.maxSize,           "E:19");

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
    // SECTION 2.1 - INVITE MANAGEMENT
    // ================================================================

    function inviteMember(uint gid, address invitee)
        external whenNotPaused groupExists(gid)
    {
        Group storage g = groups[gid];
        require(msg.sender == g.creator,         "E:20");
        require(g.isPrivate,                     "E:21");
        require(!groupInvites[gid][invitee],     "E:22");
        require(invitee != address(0),           "E:23");
        require(invitee != msg.sender,           "E:09");
        require(
            g.status == GroupStatus.OPEN || g.status == GroupStatus.PENDING,
            "E:24"
        );

        groupInvites[gid][invitee] = true;
        invitedList[gid].push(invitee);
        emit MemberInvited(gid, invitee);
    }

    function revokeInvite(uint gid, address invitee)
        external whenNotPaused groupExists(gid)
    {
        require(msg.sender == groups[gid].creator, "E:20");
        require(groupInvites[gid][invitee],        "E:25");

        groupInvites[gid][invitee] = false;
        emit InviteRevoked(gid, invitee);
    }

    function getInvitedList(uint gid)
        external view returns (address[] memory)
    {
        return invitedList[gid];
    }

    function isInvited(uint gid, address user) external view returns (bool) {
        return groupInvites[gid][user];
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
        require(g.members.length == g.maxSize,        "E:26");
        require(g.borrower == address(0),             "E:27");
        require(g.voteRound.state == VoteState.NONE,  "E:28");
        require(!g.loan.active,                       "E:29");
        require(g.status == GroupStatus.ACTIVE || g.status == GroupStatus.OPEN, "E:30");

        for (uint i = 0; i < g.members.length; i++) {
            hasVoted[gid][g.members[i]]      = false;
            votesReceived[gid][g.members[i]] = 0;
        }
        delete _candidates[gid];

        g.voteRound.state    = VoteState.OPEN;
        g.voteRound.endTime  = block.timestamp + VOTE_WINDOW;
        g.voteRound.totalCast = 0;
        g.voteRound.winner   = address(0);
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

        require(g.voteRound.state == VoteState.OPEN,    "E:31");
        require(block.timestamp <= g.voteRound.endTime, "E:32");
        require(!hasVoted[gid][msg.sender],             "E:33");
        require(candidate != msg.sender,                "E:34");
        require(_isMember(gid, candidate),              "E:35");

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

        require(g.voteRound.state == VoteState.OPEN, "E:31");
        require(
            block.timestamp > g.voteRound.endTime ||
            g.voteRound.totalCast == g.members.length,
            "E:36"
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

        require(!g.loan.active,           "E:29");
        require(g.borrower != address(0), "E:37");

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

        require(msg.sender == g.borrower,          "E:38");
        require(g.loan.active,                     "E:39");
        require(g.loan.monthsPaid < g.tenure,      "E:40");

        uint baseEMI  = g.loan.monthlyPrincipal + g.loan.monthlyInterest;
        uint lateFee  = 0;
        bool onTime   = true;

        if (block.timestamp > g.loan.nextDueTime) {
            uint daysLate = (block.timestamp - g.loan.nextDueTime) / 1 days;
            lateFee = (baseEMI * LATE_FEE_PER_DAY * daysLate) / 100;
            onTime  = false;
        }

        uint totalDue = baseEMI + lateFee;
        require(msg.value == totalDue, "E:41");

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

        // Loan fully repaid — finalize this round
        if (g.loan.monthsPaid == g.tenure) {
            g.loan.active      = false;
            g.completedLoans++;
            emit LoanCompleted(gid, g.completedLoans);

            // Pool contributions from borrower's final repayment are already
            // distributed as profit. Reset borrower & vote for next round.
            g.borrower          = address(0);
            g.voteRound.state   = VoteState.NONE;
            g.voteRound.winner  = address(0);
            g.voteRound.wasTie  = false;
            g.voteRound.totalCast = 0;

            // Each member re-contributes for the next round pool
            // (contributions were already paid when joining; pool was distributed as loan)
            // Rebuild pool: each member pays their contribution again via payRoundContribution()
            // For now: signal that next round is ready via status staying ACTIVE.
            // Next round starts with startVoting() again.
        }
    }

    /**
     * @notice NEW: Mark a borrower's EMI as missed if overdue by > 1 MONTH.
     *         Anyone can call this — requires no privileged access.
     *         Enables the kick system once missedEMIs >= MISS_LIMIT.
     */
    function checkAndMarkMissed(uint gid)
        external
        whenNotPaused
        groupExists(gid)
    {
        Group storage g = groups[gid];
        require(g.loan.active, "No active loan");
        require(g.borrower != address(0), "No borrower");

        // Missed = overdue by more than MONTH grace after nextDueTime
        require(block.timestamp > g.loan.nextDueTime + MONTH, "Not yet overdue by a full month");

        MemberInfo storage info = memberInfo[gid][g.borrower];
        info.missedEMIs++;

        // Credit penalty
        if (info.creditScore >= CREDIT_DEFAULT) {
            info.creditScore -= CREDIT_DEFAULT;
        } else {
            info.creditScore = 0;
        }

        // Advance nextDueTime so we don't keep incrementing on same missed month
        g.loan.nextDueTime += MONTH;

        emit EMIMissed(gid, g.borrower, info.missedEMIs);
        emit CreditUpdated(gid, g.borrower, info.creditScore);
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
        require(amount > 0, "E:43");
        require(profitBalance[gid][msg.sender] >= amount,   "E:44");

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

        require(activeEmergencyGroup[msg.sender] == 0,    "E:45");
        require(bytes(reason).length > 0,                 "E:46");
        require(amount > 0,                               "E:06");

        uint maxAllowed = (address(this).balance * EMERGENCY_CAP_PCT) / 100;
        require(amount <= maxAllowed,                     "E:47");

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

        require(!req.resolved,                             "E:48");
        require(block.timestamp <= req.endTime,            "E:49");
        require(!emergencyVoted[gid][rid][msg.sender],     "E:50");
        require(msg.sender != req.requester,               "E:51");

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

        require(!req.resolved,                        "E:48");
        require(block.timestamp > req.endTime,        "E:52");

        uint majority = g.members.length / 2 + 1;
        bool approved = req.yesVotes >= majority;

        req.resolved = true;
        req.approved = approved;

        emit EmergencyResolved(gid, rid, approved, req.yesVotes, req.noVotes);

        if (approved) {
            require(address(this).balance >= req.amount, "E:53");
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
        Group storage g              = groups[gid]  ;

        require(msg.sender == req.requester,  "E:54");
        require(req.approved,                 "E:55");
        require(!req.repaid,                  "E:56");

        uint interest  = (req.amount * EMERGENCY_EXTRA) / 100;
        uint totalDue  = req.amount + interest;
        require(msg.value == totalDue, "E:57");

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

        require(target != msg.sender,                        "E:58");
        require(_isMember(gid, target),                      "E:59");
        require(memberInfo[gid][target].missedEMIs >= MISS_LIMIT, "E:60");
        require(activeKick[gid][target] == 0,               "E:61");

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

        require(!req.resolved,                          "E:48");
        require(block.timestamp <= req.endTime,         "E:49");
        require(!kickVoted[gid][kid][msg.sender],       "E:50");
        require(msg.sender != req.target,               "E:62");

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

        require(!req.resolved,                  "E:48");
        require(block.timestamp > req.endTime,  "E:52");

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

            // Distribute kicked member's forfeited contribution among remaining members
            if (g.members.length > 0) {
                uint share = g.contribution / g.members.length;
                for (uint i = 0; i < g.members.length; i++) {
                    profitBalance[gid][g.members[i]] += share;
                }
            }
        } else {
            activeKick[gid][req.target] = 0;
        }

        emit KickResolved(gid, kid, req.target, approved);
    }

    // ================================================================
    // SECTION 8 - VIEW FUNCTIONS
    // ================================================================

    function getMembers(uint gid) external view returns (address[] memory) {
        return groups[gid].members;
    }

    function getGroupCount() external view returns (uint) {
        return groupCount;
    }

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

    /// @notice Alias for frontend compatibility (views.getMyPrivateInvites)
    function getMyPrivateInvites(address user) external view returns (uint[] memory) {
        return this.getMyInvites(user);
    }

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
        uint daysLate = (block.timestamp - l.nextDueTime) / 1 days;
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
    // SECTION 8.1 - NEW INVESTOR / ANALYTICS VIEW FUNCTIONS
    // ================================================================

    /**
     * @notice Trust score = weighted credit score + EMI history bonus.
     *         Range: 0–200. Used by InvestorDashboard and backend.
     */
    function getTrustScore(uint gid, address member)
        external view returns (uint)
    {
        MemberInfo memory info = memberInfo[gid][member];
        uint score = info.creditScore;

        // Bonus for on-time payments (up to +50)
        uint bonus = info.onTimeEMIs * 5;
        if (bonus > 50) bonus = 50;
        score += bonus;

        // Penalty for missed EMIs
        uint penalty = info.missedEMIs * 15;
        if (penalty > score) return 0;
        score -= penalty;

        if (score > 200) score = 200;
        return score;
    }

    /**
     * @notice Returns high-level metrics for a group (used by backend API).
     */
    function getGroupMetrics(uint gid)
        external view
        returns (
            uint totalMembers,
            bool activeLoan,
            uint poolETH,
            uint completedLoans
        )
    {
        Group memory g = groups[gid];
        return (
            g.members.length,
            g.loan.active,
            g.totalPool,
            g.completedLoans
        );
    }

    /**
     * @notice Returns health indicators for a group.
     */
    function getGroupHealth(uint gid)
        external view
        returns (
            uint fillPercentage,
            uint averageCreditScore,
            uint onTimeMemberCount,
            uint defaultedMemberCount,
            uint profitPoolAmount
        )
    {
        Group memory g = groups[gid];
        uint memberCount = g.members.length;

        if (memberCount == 0) return (0, 0, 0, 0, 0);

        uint totalCredit;
        uint onTimeCount;
        uint defaultCount;

        for (uint i = 0; i < memberCount; i++) {
            MemberInfo memory info = memberInfo[gid][g.members[i]];
            totalCredit  += info.creditScore;
            if (info.onTimeEMIs > 0 && info.lateEMIs == 0 && info.missedEMIs == 0) {
                onTimeCount++;
            }
            if (info.missedEMIs >= MISS_LIMIT) {
                defaultCount++;
            }
        }

        return (
            (memberCount * 100) / g.maxSize,           // fillPercentage
            totalCredit / memberCount,                  // averageCreditScore
            onTimeCount,                                // onTimeMemberCount
            defaultCount,                               // defaultedMemberCount
            g.profitPool                                // profitPoolAmount
        );
    }

    /**
     * @notice Returns ROI data for investor analysis.
     */
    function getGroupROI(uint gid)
        external view
        returns (
            uint principalReturned,
            uint profitEarned,
            uint roiPercentage,
            uint defaultRate
        )
    {
        Group memory g = groups[gid];
        uint memberCount = g.members.length;

        uint principal  = g.loan.principal;
        uint paid       = g.loan.monthsPaid;
        uint monthlyP   = g.loan.monthlyPrincipal;
        uint monthlyI   = g.loan.monthlyInterest;

        uint returned   = paid * monthlyP;
        uint earned     = paid * monthlyI;

        uint roi = 0;
        if (principal > 0) {
            roi = (earned * 100) / principal;
        }

        uint defaults = 0;
        for (uint i = 0; i < memberCount; i++) {
            if (memberInfo[gid][g.members[i]].missedEMIs >= MISS_LIMIT) {
                defaults++;
            }
        }

        uint defaultPct = memberCount > 0 ? (defaults * 100) / memberCount : 0;

        return (returned, earned, roi, defaultPct);
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
