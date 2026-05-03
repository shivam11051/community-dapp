# BlockChit — Decentralized Community Lending Platform

> Trustless chit funds and rotating savings groups on Ethereum. Every rule enforced by smart contracts — no middlemen, no fraud, full transparency.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-blue?style=for-the-badge)](https://shivam11051.github.io/community-dapp)
[![Contract](https://img.shields.io/badge/Contract-Sepolia%20Verified-green?style=for-the-badge)](https://sepolia.etherscan.io/address/0xc4C2B43cB3e41724a55002174D1cddEbB8E294A7)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?style=for-the-badge&logo=solidity)](https://soliditylang.org)

---

## What is BlockChit?

In India, millions of people participate in informal savings circles called chit funds, beesee, or ROSCAs. These work by having a group pool money every month and one member receives the entire pot. The problem is they run entirely on trust — the organiser holds the money, keeps paper records, and decides who gets paid first. Fraud and disputes are common.

BlockChit moves this system on-chain. The smart contract holds the funds, members vote democratically for the borrower, and every rupee movement is recorded permanently on the blockchain. No organiser can disappear with the money. No records can be altered.

---

## Live Demo

**DApp:** https://shivam11051.github.io/community-dapp

**Requires MetaMask on Ethereum Sepolia Testnet.**
Get free Sepolia ETH from: https://sepoliafaucet.com

---

## Smart Contract

| Field | Value |
|-------|-------|
| Network | Ethereum Sepolia Testnet (Chain ID: 11155111) |
| Address | `0xc4C2B43cB3e41724a55002174D1cddEbB8E294A7` |
| Etherscan | https://sepolia.etherscan.io/address/0xc4C2B43cB3e41724a55002174D1cddEbB8E294A7 |
| Language | Solidity 0.8.20 |
| Security | OpenZeppelin ReentrancyGuard + Pausable |

---

## Features

| Feature | Description |
|---------|-------------|
| **Group Lending** | Create public or invite-only lending groups with custom size and tenure |
| **Democratic Voting** | Members vote on-chain for the borrower — deterministic, bias-free |
| **EMI Automation** | Smart contract enforces monthly repayments with automatic late fees |
| **Emergency Fund** | Members can request emergency funds — group votes to approve or reject |
| **Credit Score** | On-chain payment history tracked per member per group |
| **Profit Sharing** | Interest earned distributed proportionally to all members |
| **Kick Mechanism** | Members vote to remove persistent defaulters |
| **INR Display** | All amounts shown in both ETH and Indian Rupees |
| **Admin Controls** | Contract pause/unpause, group approval queue |

---

## Tech Stack

```
Frontend   →  React 18 + Ethers.js v6 + CSS3
Contract   →  Solidity 0.8.20 + OpenZeppelin v4.9.3
Network    →  Ethereum Sepolia Testnet
Hosting    →  GitHub Pages (frontend) + Alchemy RPC
```

---

## Project Structure

```
blockchit/
├── contracts/
│   └── CommunityFinance.sol      # Main smart contract (v2.1)
├── src/
│   ├── App.js                    # Root component, wallet connection, global state
│   ├── App.css                   # Global styles
│   ├── index.js                  # React entry point
│   └── components/
│       ├── Logo.js               # Brand logo component
│       ├── GroupDiscovery.js     # Browse and join lending groups
│       ├── CreateGroup.js        # Create new group (public/private)
│       ├── MemberDashboard.js    # Active member view — pool, EMI, credit score
│       ├── AdminDashboard.js     # Admin control panel — approve groups, metrics
│       ├── VotingScreen.js       # Cast and resolve borrower votes
│       ├── EMIScreen.js          # Borrower EMI repayment interface
│       ├── EmergencyScreen.js    # Emergency fund requests and voting
│       └── TransactionHistory.js # Full on-chain transaction log
├── public/
│   └── index.html
└── package.json
```

---

## Setup and Run Locally

**Prerequisites:** Node.js 18+, MetaMask browser extension

```bash
# Clone the repo
git clone https://github.com/shivam11051/community-dapp.git
cd community-dapp

# Install dependencies
npm install

# Start development server
npm start
```

Open http://localhost:3000 in your browser. Connect MetaMask to Sepolia testnet.

---

## How It Works

```
1. CONNECT    →  User connects MetaMask wallet
2. CREATE     →  Group creator sets size, tenure, contribution amount
3. APPROVE    →  Admin reviews and approves the group
4. JOIN       →  Members join by paying the contribution in ETH
5. VOTE       →  Once full, members vote for who borrows first
6. BORROW     →  Winner receives the entire pool directly to their wallet
7. REPAY      →  Borrower pays monthly EMIs (late fee auto-applied if overdue)
8. PROFIT     →  Interest collected is split among all members
```

---

## Smart Contract Architecture

The contract (`CommunityFinance.sol`) is organized in 9 sections:

1. **Admin Controls** — `approveGroup`, `rejectGroup`, `pause`, `unpause`
2. **Group Management** — `createGroup`, `joinGroup`, `expireGroup`
3. **Invite System** — `inviteMember`, `revokeInvite`, `getInvitedList`
4. **Voting** — `startVoting`, `castVote`, `resolveVote`
5. **Loan & EMI** — `releaseFunds`, `payEMI`
6. **Profit** — `withdrawAllProfit`, `withdrawPartialProfit`
7. **Emergency** — `raiseEmergency`, `voteEmergency`, `resolveEmergency`, `repayEmergency`
8. **Kick** — `raiseKick`, `voteKick`, `resolveKick`
9. **View Functions** — `getMembers`, `getEMI`, `getCreditScore`, `getMemberInfo`, etc.

---

## Credit Score Formula

```
Score = (onTimePayments × 10) - (latePayments × 5) - (missedPayments × 20)
Clamped to [0, ∞]   |   Starting score: 100
```

Tracked on-chain per member per group. Updates automatically inside `payEMI()`.

---

## Security

- **ReentrancyGuard** on all fund-moving functions (`releaseFunds`, `payEMI`, `withdrawAllProfit`, `resolveKick`, `repayEmergency`)
- **Pausable** — admin can halt all user transactions in emergency
- **Access control** — `onlyAdmin`, `onlyMemberOf` modifiers on every sensitive function
- **Input validation** — `require()` checks on contribution amounts, group sizes, tenure bounds
- **Solidity 0.8.20** — built-in overflow/underflow protection

---

## Team

| Name | Enrollment | Role |
|------|-----------|------|
| Shivam Mishra | S24CSEU1470 | Smart Contract + Frontend + integration|
| Priyanshu Prakash Singh | S24CSEU1462 | Backend |

Bennett University, Greater Noida — Design Thinking and Innovation Project 2025-26

---

## License

MIT License — see [LICENSE](LICENSE) for details.
# blockchit-v2
