import { useState, useEffect, useCallback, useRef } from "react";
import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import "./App.css";
import Logo from "./components/Logo";

// ─── SCREENS ─────────────────────────────────────────────────────
import GroupDiscovery   from "./components/GroupDiscovery";
import CreateGroup      from "./components/CreateGroup";
import AdminDashboard   from "./components/AdminDashboard";
import MemberDashboard  from "./components/MemberDashboard";
import VotingScreen     from "./components/VotingScreen";
import EmergencyScreen  from "./components/EmergencyScreen";
import EMIScreen        from "./components/EMIScreen";
import TransactionHistory from "./components/TransactionHistory";
import KickScreen        from "./components/KickScreen";

// ─── CONTRACT ────────────────────────────────────────────────────
const CONTRACT_ADDRESS = "0xf7029351b6aadafcaaa792fdcc5fe4bf46a433aa"; // update after redeployment

const ABI = [
  // ── Admin
  "function approveGroup(uint gid)",
  "function rejectGroup(uint gid)",
  "function pause()",
  "function unpause()",
  "function paused() view returns (bool)",

  // ── Group Management
  "function createGroup(string name, uint maxSize, uint tenure, bool isPrivate, address[] invites) payable",
  "function inviteMember(uint gid, address invitee)",
  "function revokeInvite(uint gid, address invitee)",
  "function getMyInvites(address user) view returns (uint[])",
  "function getMyPrivateInvites(address user) view returns (uint[])",
  "function isInvited(uint, address) view returns (bool)",
  "event MemberInvited(uint indexed gid, address indexed invitee)",
  "event InviteRevoked(uint indexed gid, address indexed invitee)",
  "function joinGroup(uint gid) payable",
  "function expireGroup(uint gid)",
  "function groupCount() view returns (uint)",
  "function getOpenGroups() view returns (uint[])",
  "function getPendingGroups() view returns (uint[])",
  "function memberGroup(address) view returns (uint)",
  "function inGroup(address) view returns (bool)",
  "function admin() view returns (address)",

  // ── Group Data
  "function groups(uint) view returns (uint id, string name, address creator, uint8 status, uint contribution, uint maxSize, uint tenure, uint fillDeadline, address borrower, uint emergencyCount, uint kickCount, uint totalPool, uint profitPool)",
  "function getMembers(uint gid) view returns (address[])",

  // ── Voting
  "function startVoting(uint gid)",
  "function castVote(uint gid, address candidate)",
  "function resolveVote(uint gid)",
  "function hasVoted(uint, address) view returns (bool)",
  "function votesReceived(uint, address) view returns (uint)",

  // ── Loan & EMI
  "function releaseFunds(uint gid)",
  "function payEMI(uint gid) payable",
  "function getEMI(uint gid) view returns (uint)",
  "function getEMIinINR(uint gid) view returns (uint)",
  "function getLateFee(uint gid) view returns (uint)",
  "function getNextDueTime(uint gid) view returns (uint)",
  "function getRemainingMonths(uint gid) view returns (uint)",
  "function getPoolBalance(uint gid) view returns (uint)",
  "function getPoolInINR(uint gid) view returns (uint)",

  // ── Profit
  "function withdrawAllProfit(uint gid)",
  "function withdrawPartialProfit(uint gid, uint amount)",
  "function getProfitBalance(uint gid, address member) view returns (uint)",
  "function profitBalance(uint, address) view returns (uint)",

  // ── Credit Score
  "function getCreditScore(uint gid, address member) view returns (uint)",
  "function getMemberInfo(uint gid, address member) view returns (uint creditScore, uint missed, uint onTime, uint late)",

  // ── Emergency
  "function raiseEmergency(uint gid, uint amount, string reason)",
  "function voteEmergency(uint gid, uint rid, bool support)",
  "function resolveEmergency(uint gid, uint rid)",
  "function repayEmergency(uint gid, uint rid) payable",
  "function emergencyRequests(uint, uint) view returns (uint id, address requester, uint amount, string reason, uint endTime, uint yesVotes, uint noVotes, bool resolved, bool approved, bool repaid, uint repayBy)",
  "function emergencyVoted(uint, uint, address) view returns (bool)",
  "function activeEmergencyGroup(address) view returns (uint)",

  // ── Kick
  "function raiseKick(uint gid, address target)",
  "function voteKick(uint gid, uint kid, bool support)",
  "function resolveKick(uint gid, uint kid)",
  "function kickRequests(uint, uint) view returns (uint id, address target, address raisedBy, uint endTime, uint yesVotes, uint noVotes, bool resolved, bool approved)",
  "function activeKick(uint, address) view returns (uint)",

  // ── INR helpers
  "function ethToINR(uint ethAmount) pure returns (uint)",

  // ── Events
  "event GroupCreated(uint indexed gid, address creator, string name, uint contribution, uint maxSize, uint tenure, bool isPrivate)",
  "event GroupApproved(uint indexed gid)",
  "event GroupRejected(uint indexed gid)",
  "event GroupClosed(uint indexed gid, string reason)",
  "event MemberJoined(uint indexed gid, address member)",
  "event VotingStarted(uint indexed gid, uint endTime)",
  "event VoteCast(uint indexed gid, address voter, address candidate)",
  "event BorrowerSelected(uint indexed gid, address borrower, bool wasTie)",
  "event LoanReleased(uint indexed gid, address borrower, uint amount)",
  "event EMIPaid(uint indexed gid, address borrower, uint amount, uint month, uint lateFee)",
  "event ProfitWithdrawn(uint indexed gid, address member, uint amount)",
  "event CreditUpdated(uint indexed gid, address member, uint newScore)",
  "event EmergencyRequested(uint indexed gid, uint indexed rid, address requester, uint amount, string reason)",
  "event EmergencyVoteCast(uint indexed gid, uint indexed rid, address voter, bool support)",
  "event EmergencyResolved(uint indexed gid, uint indexed rid, bool approved, uint yes, uint no)",
  "event EmergencyReleased(uint indexed gid, uint indexed rid, address requester, uint amount)",
  "event EmergencyRepaid(uint indexed gid, uint indexed rid, address requester, uint amount)",
  "event KickRaised(uint indexed gid, uint indexed kid, address target, address raisedBy)",
  "event KickVoteCast(uint indexed gid, uint indexed kid, address voter, bool support)",
  "event KickResolved(uint indexed gid, uint indexed kid, address target, bool kicked)",
];

// ─── NOTIFICATION TYPES ──────────────────────────────────────────
const NOTIF = {
  SUCCESS: "success",
  ERROR:   "error",
  INFO:    "info",
  WARNING: "warning",
  TX:      "tx",
};

export default function App() {
  // ── Wallet & Contract
  const [provider,  setProvider]  = useState(null);
  const [contract,  setContract]  = useState(null);
  const [account,   setAccount]   = useState("");
  const [isAdmin,   setIsAdmin]   = useState(false);
  const [chainId,   setChainId]   = useState(null);

  // ── Navigation
  const [screen, setScreen] = useState("discovery"); // current screen
  const [activeGroupId, setActiveGroupId] = useState(null); // group being viewed

  // ── Currency toggle
  const [currency, setCurrency] = useState("INR");

  // ── Global group state
  const [myGroupId,   setMyGroupId]   = useState(0);   // 0 = not in any group
  const [groupCount,  setGroupCount]  = useState(0);
  const [openGroups,  setOpenGroups]  = useState([]);   // array of group ids
  const [pendingGroups, setPendingGroups] = useState([]);
  const [groupCache,  setGroupCache]  = useState({});   // id => group data

  // ── Notifications
  const [notifications, setNotifications] = useState([]);
  const notifId = useRef(0);

  // ── Loading states
  const [loading, setLoading] = useState(false);
  const [txPending, setTxPending] = useState(false);

  // ════════════════════════════════════════════════════════════════
  // NOTIFICATION SYSTEM
  // ════════════════════════════════════════════════════════════════

  const addNotif = useCallback((message, type = NOTIF.INFO, duration = 5000) => {
    const id = ++notifId.current;
    setNotifications(prev => [{ id, message, type, time: Date.now() }, ...prev.slice(0, 9)]);
    if (duration > 0) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeNotif = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // ════════════════════════════════════════════════════════════════
  // WALLET CONNECTION
  // ════════════════════════════════════════════════════════════════

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        addNotif("MetaMask not found. Please install it.", NOTIF.ERROR);
        return;
      }

      setLoading(true);
      const _provider  = new BrowserProvider(window.ethereum);
      const _signer    = await _provider.getSigner();
      const _contract  = new Contract(CONTRACT_ADDRESS, ABI, _signer);
      const _account   = await _signer.getAddress();
      const _network   = await _provider.getNetwork();

      // Try to get admin — graceful fallback if old contract
      let _isAdmin = false;
      try {
        const _adminAddr = await _contract.admin();
        _isAdmin = _account.toLowerCase() === _adminAddr.toLowerCase();
      } catch {
        console.log("admin() not available on this contract");
      }

      setProvider(_provider);
      setContract(_contract);
      setAccount(_account);
      setChainId(_network.chainId.toString());
      setIsAdmin(_isAdmin);

      await loadGlobalState(_contract, _account);
      setupEventListeners(_contract, _account);

      addNotif(`Wallet connected: ${_account.slice(0,6)}...${_account.slice(-4)}`, NOTIF.SUCCESS);
    } catch (err) {
      addNotif("Failed to connect wallet: " + err.message, NOTIF.ERROR);
    } finally {
      setLoading(false);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // GLOBAL STATE LOADER
  // ════════════════════════════════════════════════════════════════

  async function loadGlobalState(c, acc) {
    try {
      const count   = await c.groupCount();
      const inGrp   = await c.inGroup(acc);
      const myGid   = inGrp ? Number(await c.memberGroup(acc)) : 0;
      const openIds = (await c.getOpenGroups()).map(Number);

      setGroupCount(Number(count));
      setMyGroupId(myGid);
      setOpenGroups(openIds);

      // Load admin pending groups
      const pendingIds = (await c.getPendingGroups()).map(Number);
      setPendingGroups(pendingIds);

      // Cache group data for discovered groups
      const toLoad = [...new Set([...openIds, ...(myGid ? [myGid] : [])])];
      const cache  = {};
      for (const gid of toLoad) {
        cache[gid] = await loadGroupData(c, gid);
      }
      setGroupCache(cache);

      // Only redirect to dashboard if group is OPEN(1) or ACTIVE(2) — not PENDING(0)
      if (myGid > 0) {
        const myGroup = cache[myGid];
        const status  = myGroup ? myGroup.status : -1;
        setActiveGroupId(myGid);
        // status 0 = PENDING (awaiting admin) — stay on discovery, show pending notice
        // status 1 = OPEN, 2 = ACTIVE, 3 = CLOSED — go to dashboard
        if (status > 0) {
          setScreen("dashboard");
        }
      }
    } catch (err) {
      console.error("loadGlobalState error:", err);
    }
  }

  async function loadGroupData(c, gid) {
    try {
      const g       = await c.groups(gid);
      const members = await c.getMembers(gid);
      return {
        id:           Number(g.id),
        name:         g.name,
        creator:      g.creator,
        status:       Number(g.status),   // 0=PENDING,1=OPEN,2=ACTIVE,3=CLOSED
        contribution: g.contribution,
        maxSize:      Number(g.maxSize),
        tenure:       Number(g.tenure),
        fillDeadline: Number(g.fillDeadline),
        borrower:     g.borrower,
        emergencyCount: Number(g.emergencyCount),
        kickCount:    Number(g.kickCount),
        totalPool:    g.totalPool,
        profitPool:   g.profitPool,
        isPrivate:    g.isPrivate ?? false,
        members,
        memberCount:  members.length,
      };
    } catch (err) {
      console.error(`loadGroupData(${gid}) error:`, err);
      return null;
    }
  }

  async function refreshGroup(gid) {
    if (!contract || !gid) return;
    const data = await loadGroupData(contract, gid);
    setGroupCache(prev => ({ ...prev, [gid]: data }));
  }

  // ════════════════════════════════════════════════════════════════
  // LIVE EVENT LISTENERS
  // ════════════════════════════════════════════════════════════════

  function setupEventListeners(c, acc) {
    // Group events
    c.on("GroupApproved", (gid) => {
      addNotif(`Group #${gid} approved by admin!`, NOTIF.SUCCESS);
      loadGlobalState(c, acc);
    });

    c.on("GroupRejected", (gid) => {
      addNotif(`Group #${gid} was rejected.`, NOTIF.WARNING);
      loadGlobalState(c, acc);
    });

    c.on("MemberJoined", (gid, member) => {
      if (member.toLowerCase() !== acc.toLowerCase()) {
        addNotif(`New member joined Group #${gid}`, NOTIF.INFO);
      }
      refreshGroup(Number(gid));
    });

    // Voting events
    c.on("VotingStarted", (gid, endTime) => {
      addNotif(`Voting started in Group #${gid}!`, NOTIF.INFO);
      refreshGroup(Number(gid));
    });

    c.on("VoteCast", (gid, voter) => {
      if (voter.toLowerCase() !== acc.toLowerCase()) {
        addNotif(`A vote was cast in Group #${gid}`, NOTIF.INFO);
      }
    });

    c.on("BorrowerSelected", (gid, borrower, wasTie) => {
      const msg = wasTie
        ? `Borrower selected by tiebreaker in Group #${gid}`
        : `Borrower selected by vote in Group #${gid}`;
      addNotif(msg, NOTIF.SUCCESS);
      refreshGroup(Number(gid));
    });

    // Loan events
    c.on("LoanReleased", (gid, borrower, amount) => {
      if (borrower.toLowerCase() === acc.toLowerCase()) {
        addNotif(`Loan of ${formatEther(amount)} ETH released to you!`, NOTIF.SUCCESS, 0);
      }
      refreshGroup(Number(gid));
    });

    c.on("EMIPaid", (gid, borrower, amount, month, lateFee) => {
      const fee = Number(lateFee) > 0 ? ` (late fee: ${formatEther(lateFee)} ETH)` : "";
      addNotif(`EMI #${month} paid in Group #${gid}${fee}`, NOTIF.INFO);
      refreshGroup(Number(gid));
    });

    // Credit score
    c.on("CreditUpdated", (gid, member, newScore) => {
      if (member.toLowerCase() === acc.toLowerCase()) {
        addNotif(`Your credit score updated to ${newScore}`, NOTIF.INFO);
      }
    });

    // Profit events
    c.on("ProfitWithdrawn", (gid, member, amount) => {
      if (member.toLowerCase() === acc.toLowerCase()) {
        addNotif(`Profit of ${formatEther(amount)} ETH withdrawn!`, NOTIF.SUCCESS);
      }
    });

    // Emergency events
    c.on("EmergencyRequested", (gid, rid, requester, amount, reason) => {
      if (requester.toLowerCase() !== acc.toLowerCase()) {
        addNotif(`Emergency request in Group #${gid}: "${reason}"`, NOTIF.WARNING, 0);
      }
    });

    c.on("EmergencyResolved", (gid, rid, approved) => {
      addNotif(
        `Emergency #${rid} in Group #${gid} ${approved ? "APPROVED" : "REJECTED"}`,
        approved ? NOTIF.SUCCESS : NOTIF.WARNING
      );
    });

    c.on("EmergencyReleased", (gid, rid, requester, amount) => {
      if (requester.toLowerCase() === acc.toLowerCase()) {
        addNotif(`Emergency funds of ${formatEther(amount)} ETH sent to you!`, NOTIF.SUCCESS, 0);
      }
    });

    // Kick events
    c.on("KickRaised", (gid, kid, target) => {
      if (target.toLowerCase() === acc.toLowerCase()) {
        addNotif(`A kick request has been raised against you in Group #${gid}!`, NOTIF.ERROR, 0);
      } else {
        addNotif(`Kick request raised in Group #${gid}`, NOTIF.WARNING);
      }
    });

    c.on("KickResolved", (gid, kid, target, kicked) => {
      if (target.toLowerCase() === acc.toLowerCase()) {
        addNotif(
          kicked ? `You were removed from Group #${gid}` : `Kick vote failed — you stay in Group #${gid}`,
          kicked ? NOTIF.ERROR : NOTIF.SUCCESS,
          0
        );
      }
    });
  }

  // ── Account change listener
  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccChange = () => window.location.reload();
    window.ethereum.on("accountsChanged", handleAccChange);
    return () => window.ethereum.removeListener("accountsChanged", handleAccChange);
  }, []);

  // ── Mobile MetaMask redirect
  useEffect(() => {
    const isMobile = /iPhone|Android/i.test(navigator.userAgent);
    if (isMobile && !window.ethereum) {
      window.location.href = "https://metamask.app.link/dapp/shivam11051.github.io/community-dapp";
    }
  }, []);

  // ════════════════════════════════════════════════════════════════
  // TX WRAPPER — wraps any contract call with loading + notifs
  // ════════════════════════════════════════════════════════════════

  async function sendTx(fn, successMsg, errorMsg) {
    // Network guard — force Sepolia before every tx
    try {
      const network = await provider.getNetwork();
      const cid = network.chainId.toString();
      if (cid !== "11155111") {
        addNotif("Wrong network! Please switch MetaMask to Sepolia testnet.", NOTIF.ERROR, 0);
        // Auto-prompt switch
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xaa36a7" }], // Sepolia chainId in hex
          });
        } catch (e) { console.log(e); }
        return false;
      }
    } catch (e) { console.log(e); }

    setTxPending(true);
    const pendingId = addNotif("Transaction pending...", NOTIF.TX, 0);
    try {
      const tx = await fn();
      await tx.wait();
      removeNotif(pendingId);
      addNotif(successMsg || "Transaction confirmed!", NOTIF.SUCCESS);
      return true;
    } catch (err) {
      removeNotif(pendingId);
      const msg = err?.reason || err?.message || "Transaction failed";
      addNotif(errorMsg || msg, NOTIF.ERROR);
      return false;
    } finally {
      setTxPending(false);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // CONTRACT ACTION HANDLERS (passed as props to screens)
  // ════════════════════════════════════════════════════════════════

  const actions = {
    // ── Group
    createGroup: async (name, maxSize, tenure, ethAmount, isPrivate = false, invites = []) => {      const ok = await sendTx(
        () => contract.createGroup(name, maxSize, tenure, isPrivate, invites, { value: parseEther(ethAmount) }),
        `Group "${name}" created! Waiting for admin approval.`
      );
      if (ok) await loadGlobalState(contract, account);
      return ok;
    },

    inviteMember: async (gid, invitee) => {
      return await sendTx(
        () => contract.inviteMember(gid, invitee),
        `${invitee.slice(0,8)}... invited successfully!`
      );
    },

    revokeInvite: async (gid, invitee) => {
      return await sendTx(
        () => contract.revokeInvite(gid, invitee),
        "Invite revoked."
      );
    },

    joinGroup: async (gid) => {
      const g = groupCache[gid];
      if (!g) return;
      const ok = await sendTx(
        () => contract.joinGroup(gid, { value: g.contribution }),
        `Joined Group #${gid} successfully!`
      );
      if (ok) {
        await loadGlobalState(contract, account);
        setActiveGroupId(gid);
        setScreen("dashboard");
      }
    },

    approveGroup: async (gid) => {
      const ok = await sendTx(
        () => contract.approveGroup(gid),
        `Group #${gid} approved!`
      );
      if (ok) await loadGlobalState(contract, account);
    },

    rejectGroup: async (gid) => {
      const ok = await sendTx(
        () => contract.rejectGroup(gid),
        `Group #${gid} rejected.`
      );
      if (ok) await loadGlobalState(contract, account);
    },

    expireGroup: async (gid) => {
      const ok = await sendTx(
        () => contract.expireGroup(gid),
        `Group #${gid} expired and members refunded.`
      );
      if (ok) await loadGlobalState(contract, account);
    },

    // ── Voting
    startVoting: async (gid) => {
      const ok = await sendTx(
        () => contract.startVoting(gid),
        "Voting started! Members can now cast their votes."
      );
      if (ok) await refreshGroup(gid);
    },

    castVote: async (gid, candidate) => {
      const ok = await sendTx(
        () => contract.castVote(gid, candidate),
        "Your vote has been cast!"
      );
      if (ok) await refreshGroup(gid);
    },

    resolveVote: async (gid) => {
      const ok = await sendTx(
        () => contract.resolveVote(gid),
        "Vote resolved! Borrower selected."
      );
      if (ok) await refreshGroup(gid);
    },

    // ── Loan
    releaseFunds: async (gid) => {
      const ok = await sendTx(
        () => contract.releaseFunds(gid),
        "Funds released to borrower!"
      );
      if (ok) await refreshGroup(gid);
    },

    payEMI: async (gid) => {
      const emi      = await contract.getEMI(gid);
      const lateFee  = await contract.getLateFee(gid);
      const total    = emi + lateFee;
      const ok = await sendTx(
        () => contract.payEMI(gid, { value: total }),
        "EMI paid successfully!"
      );
      if (ok) await refreshGroup(gid);
    },

    // ── Profit
    withdrawAllProfit: async (gid) => {
      const ok = await sendTx(
        () => contract.withdrawAllProfit(gid),
        "Full profit withdrawn!"
      );
      if (ok) await refreshGroup(gid);
    },

    withdrawPartialProfit: async (gid, amount) => {
      const ok = await sendTx(
        () => contract.withdrawPartialProfit(gid, parseEther(amount)),
        `${amount} ETH profit withdrawn!`
      );
      if (ok) await refreshGroup(gid);
    },

    // ── Emergency
    raiseEmergency: async (gid, amount, reason) => {
      const ok = await sendTx(
        () => contract.raiseEmergency(gid, parseEther(amount), reason),
        "Emergency request submitted!"
      );
      if (ok) await refreshGroup(gid);
    },

    voteEmergency: async (gid, rid, support) => {
      const ok = await sendTx(
        () => contract.voteEmergency(gid, rid, support),
        `Vote ${support ? "YES" : "NO"} cast on emergency request.`
      );
      if (ok) await refreshGroup(gid);
    },

    resolveEmergency: async (gid, rid) => {
      const ok = await sendTx(
        () => contract.resolveEmergency(gid, rid),
        "Emergency request resolved!"
      );
      if (ok) await refreshGroup(gid);
    },

    repayEmergency: async (gid, rid, amount) => {
      const ok = await sendTx(
        () => contract.repayEmergency(gid, rid, { value: parseEther(amount) }),
        "Emergency loan repaid!"
      );
      if (ok) await refreshGroup(gid);
    },

    // ── Kick
    raiseKick: async (gid, target) => {
      const ok = await sendTx(
        () => contract.raiseKick(gid, target),
        "Kick request raised!"
      );
      if (ok) await refreshGroup(gid);
    },

    voteKick: async (gid, kid, support) => {
      const ok = await sendTx(
        () => contract.voteKick(gid, kid, support),
        "Kick vote cast!"
      );
      if (ok) await refreshGroup(gid);
    },

    resolveKick: async (gid, kid) => {
      const ok = await sendTx(
        () => contract.resolveKick(gid, kid),
        "Kick vote resolved!"
      );
      if (ok) await loadGlobalState(contract, account);
    },

    // ── Admin
    pause: async () => {
      return await sendTx(() => contract.pause(), "Contract paused successfully.");
    },

    unpause: async () => {
      return await sendTx(() => contract.unpause(), "Contract unpaused — operations resumed.");
    },
  };

  // ── View helpers (read-only, no tx)
  const views = {
    getCreditScore:    (gid, addr) => contract?.getCreditScore(gid, addr),
    getMemberInfo:     (gid, addr) => contract?.getMemberInfo(gid, addr),
    getEMI:            (gid)       => contract?.getEMI(gid),
    getEMIinINR:       (gid)       => contract?.getEMIinINR(gid),
    getLateFee:        (gid)       => contract?.getLateFee(gid),
    getNextDueTime:    (gid)       => contract?.getNextDueTime(gid),
    getRemainingMonths:(gid)       => contract?.getRemainingMonths(gid),
    getProfitBalance:  (gid, addr) => contract?.getProfitBalance(gid, addr),
    getVotesFor:       (gid, addr) => contract?.votesReceived(gid, addr),
    hasVoted:          (gid, addr) => contract?.hasVoted(gid, addr),
    getEmergencyReq:   (gid, rid)  => contract?.emergencyRequests(gid, rid),
    getKickReq:        (gid, kid)  => contract?.kickRequests(gid, kid),
    getActiveEmergency:(addr)      => contract?.activeEmergencyGroup(addr),
    getActiveKick:     (gid, addr) => contract?.activeKick(gid, addr),
    queryEvents:       (eventName, filter) => contract?.queryFilter(eventName, filter),
    getMyInvites:      ()           => contract?.getMyInvites(account),
    getMyPrivateInvites: ()         => contract?.getMyPrivateInvites(account),
    isInvited:         (gid, addr)  => contract?.isInvited(gid, addr),
  };

  // ════════════════════════════════════════════════════════════════
  // SHARED PROPS passed to every screen
  // ════════════════════════════════════════════════════════════════

  const sharedProps = {
    contract,
    account,
    isAdmin,
    currency,
    myGroupId,
    activeGroupId,
    groupCache,
    openGroups,
    pendingGroups,
    txPending,
    actions,
    views,
    navigate: (screen, gid) => {
      if (gid !== undefined) setActiveGroupId(gid);
      setScreen(screen);
    },
    refreshGroup,
    loadGlobalState: () => loadGlobalState(contract, account),
    addNotif,
  };

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════

  const networkName = chainId === "11155111" ? "Sepolia" : chainId === "1" ? "Mainnet" : chainId ? `Chain ${chainId}` : "";

  return (
    <div className="app">

      {/* ── TOPBAR ─────────────────────────────────────────────── */}
      <div className="topbar">
        <div className="logo-wrap" onClick={() => setScreen("discovery")}>
          <div className="logo-mark"><Logo size={36} /></div>
          <div className="logo-text"><span className="lo-b">Block</span><span className="lo-c">Chit</span></div>
        </div>

        <div className="topbar-center">
          {account && (
            <nav className="top-nav">
              <button className={`nav-btn ${screen === "discovery" ? "active" : ""}`}   onClick={() => setScreen("discovery")}>Discover</button>
              <button className={`nav-btn ${screen === "create"    ? "active" : ""}`}   onClick={() => setScreen("create")}>Create Group</button>
              {myGroupId > 0 && (
                <button className={`nav-btn ${screen === "dashboard"  ? "active" : ""}`} onClick={() => { setActiveGroupId(myGroupId); setScreen("dashboard"); }}>My Group</button>
              )}
              {myGroupId > 0 && (
                <button className={`nav-btn ${screen === "voting"    ? "active" : ""}`}  onClick={() => { setActiveGroupId(myGroupId); setScreen("voting"); }}>Vote</button>
              )}
              {myGroupId > 0 && (
                <button className={`nav-btn ${screen === "emergency" ? "active" : ""}`}  onClick={() => { setActiveGroupId(myGroupId); setScreen("emergency"); }}>Emergency</button>
              )}
              {myGroupId > 0 && (
                <button className={`nav-btn ${screen === "kick"      ? "active" : ""}`}  onClick={() => { setActiveGroupId(myGroupId); setScreen("kick"); }}>⚠ Kick</button>
              )}
              {myGroupId > 0 && (
                <button className={`nav-btn ${screen === "emi"       ? "active" : ""}`}  onClick={() => { setActiveGroupId(myGroupId); setScreen("emi"); }}>EMI</button>
              )}
              {myGroupId > 0 && (
                <button className={`nav-btn ${screen === "history"   ? "active" : ""}`}  onClick={() => { setActiveGroupId(myGroupId); setScreen("history"); }}>History</button>
              )}
              {isAdmin && (
                <button className={`nav-btn admin-btn ${screen === "admin" ? "active" : ""}`} onClick={() => setScreen("admin")}>Admin</button>
              )}
            </nav>
          )}
        </div>

        <div className="topbar-right">
          {account && (
            <button className="currency-toggle" onClick={() => setCurrency(c => c === "INR" ? "ETH" : "INR")}>
              {currency === "INR" ? "₹ INR" : "Ξ ETH"}
            </button>
          )}
          {networkName && (
            <div className="network-badge">
              <div className={`dot ${networkName === "Sepolia" ? "dot-green" : "dot-amber"}`} />
              {networkName}
            </div>
          )}
          {!account ? (
            <button className="btn-connect" onClick={connectWallet} disabled={loading}>
              {loading ? "Connecting..." : "Connect Wallet"}
            </button>
          ) : (
            <div className="wallet-chip">
              <div className="dot dot-green" />
              {account.slice(0, 6)}...{account.slice(-4)}
            </div>
          )}
        </div>
      </div>

      {/* ── WRONG NETWORK BANNER ──────────────────────────────── */}
      {account && chainId && chainId !== "11155111" && (
        <div className="wrong-network-banner">
          <span>
            ⚠ Wrong Network — You are on {chainId === "1" ? "Ethereum Mainnet" : `Chain ${chainId}`}.
            Transactions will fail and cost REAL ETH.
          </span>
          <button onClick={async () => {
            try {
              await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xaa36a7" }] });
            } catch { addNotif("Switch to Sepolia manually in MetaMask.", "error"); }
          }}>
            Switch to Sepolia
          </button>
        </div>
      )}

      {/* ── MAIN CONTENT ───────────────────────────────────────── */}
      <div className="main">
        {!account ? (
          /* ── LANDING ─────────────────────────────────────────── */
          <div className="landing">
            <div className="landing-hero">
              <div className="hero-tag">⬡ Powered by Ethereum · Sepolia Testnet</div>
              <h1>Community lending,<br /><span className="grad">reimagined on-chain.</span></h1>
              <p>Create trusted circles, vote for borrowers, earn profit together — every rule enforced by smart contracts, zero middlemen.</p>
              <div className="hero-btns">
                <button className="btn-primary btn-lg" onClick={connectWallet} disabled={loading}>
                  {loading ? "Connecting..." : "Connect MetaMask"}
                </button>
                <button className="btn-ghost btn-lg" onClick={() => window.open('https://sepolia.etherscan.io/address/' + '0xf7029351b6aadafcaaa792fdcc5fe4bf46a433aa', '_blank')}>
                  View Contract ↗
                </button>
              </div>
            </div>
            <div className="landing-features">
              {[
                { icon: "⬡", title: "Multi-Group", desc: "Create or join groups with custom EMI, size & tenure — public or invite-only" },
                { icon: "🗳️", title: "Vote to Borrow", desc: "Members vote democratically for who receives the loan" },
                { icon: "🚨", title: "Emergency Fund",  desc: "Need urgent money? Request it — group votes yes or no" },
                { icon: "⭐", title: "Credit Score",    desc: "On-time payments build your on-chain credit reputation" },
                { icon: "📊", title: "Profit Share",    desc: "Interest earned is split proportionally among members" },
                { icon: "🔒", title: "Trustless",       desc: "Smart contracts enforce every rule — no middlemen" },
              ].map((f, i) => (
                <div className="feature-card" key={i}>
                  <div className="feature-icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ── SCREENS ─────────────────────────────────────────── */
          <>
            {screen === "discovery" && <GroupDiscovery {...sharedProps} />}
            {screen === "create"    && <CreateGroup    {...sharedProps} />}
            {screen === "admin"     && <AdminDashboard {...sharedProps} />}
            {screen === "dashboard" && <MemberDashboard {...sharedProps} />}
            {screen === "voting"    && <VotingScreen   {...sharedProps} />}
            {screen === "emergency" && <EmergencyScreen {...sharedProps} />}
            {screen === "kick"      && <KickScreen      {...sharedProps} />}
            {screen === "emi"       && <EMIScreen      {...sharedProps} />}
            {screen === "history"   && <TransactionHistory {...sharedProps} />}
            {screen === "invites"   && <GroupDiscovery {...sharedProps} showInvitesOnly={true} />}
          </>
        )}
      </div>

      {/* ── NOTIFICATION TOASTS ────────────────────────────────── */}
      <div className="notif-container">
        {notifications.map(n => (
          <div key={n.id} className={`notif notif-${n.type}`}>
            <span className="notif-icon">
              {n.type === NOTIF.SUCCESS  ? "✓" :
               n.type === NOTIF.ERROR    ? "✕" :
               n.type === NOTIF.WARNING  ? "⚠" :
               n.type === NOTIF.TX       ? "⟳" : "ℹ"}
            </span>
            <span className="notif-msg">{n.message}</span>
            <button className="notif-close" onClick={() => removeNotif(n.id)}>✕</button>
          </div>
        ))}
      </div>

      {/* ── TX OVERLAY ─────────────────────────────────────────── */}
      {txPending && (
        <div className="tx-overlay">
          <div className="tx-spinner" />
          <p>Confirm in MetaMask...</p>
        </div>
      )}
    </div>
  );
}