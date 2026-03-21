const { ethers } = require("ethers");
require("dotenv").config();
const Event = require("../models/Event");

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const ALCHEMY_KEY = process.env.ALCHEMY_KEY;

// Minimal ABI with just the events we need
const ABI = [
  "event EMIPaid(uint indexed gid, address indexed borrower, uint amount, uint month, uint lateFee)",
  "event VoteCast(uint indexed gid, address indexed voter, address indexed candidate)",
  "event MemberJoined(uint indexed gid, address indexed member)",
  "event BorrowerSelected(uint indexed gid, address indexed borrower, bool wasTie)",
];

let provider;
let contract;
let isListening = false;

async function initContract() {
  try {
    console.log("🔌 Connecting to Alchemy...");
    provider = new ethers.JsonRpcProvider(ALCHEMY_KEY);
    
    console.log("📋 Creating contract instance...");
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    
    console.log("✅ Contract initialized successfully");
    console.log(`📍 Address: ${CONTRACT_ADDRESS}`);
    return true;
  } catch (error) {
    console.error("❌ Contract init failed:", error.message);
    return false;
  }
}

async function startEventListener() {
  console.log("🔔 Event listener service initialized");
  console.log("📍 Contract:", process.env.CONTRACT_ADDRESS);

  if (isListening) {
    console.warn("⚠️ Event listener already running");
    return;
  }

  const initialized = await initContract();
  if (!initialized) {
    console.warn("⚠️ Event listener will be offline - contract not initialized");
    return;
  }

  try {
    // ─────────────────────────────────────────────
    // EMIPaid Event Listener
    // ─────────────────────────────────────────────
    contract.on("EMIPaid", async (gid, borrower, amount, month, lateFee, event) => {
      console.log(`\n📊 ===== EMIPaid EVENT =====`);
      console.log(`   Group ID: ${gid}`);
      console.log(`   Borrower: ${borrower}`);
      console.log(`   Amount: ${amount}`);
      console.log(`   Month: ${month}`);
      console.log(`   Late Fee: ${lateFee}`);
      console.log(`   TX Hash: ${event.transactionHash}`);

      try {
        const savedEvent = await Event.create({
          eventType: "EMIPaid",
          gid: Number(gid),
          user: borrower,
          amount: amount.toString(),
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
        });
        console.log("✅ EMIPaid event saved to DB");
      } catch (error) {
        console.error("❌ Error saving EMIPaid:", error.message);
      }
    });

    // ─────────────────────────────────────────────
    // VoteCast Event Listener
    // ─────────────────────────────────────────────
    contract.on("VoteCast", async (gid, voter, candidate, event) => {
      console.log(`\n🗳️ ===== VOTECAST EVENT =====`);
      console.log(`   Group ID: ${gid}`);
      console.log(`   Voter: ${voter}`);
      console.log(`   Candidate: ${candidate}`);
      console.log(`   TX Hash: ${event.transactionHash}`);

      try {
        const savedEvent = await Event.create({
          eventType: "VoteCast",
          gid: Number(gid),
          user: voter,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
        });
        console.log("✅ VoteCast event saved to DB");
      } catch (error) {
        console.error("❌ Error saving VoteCast:", error.message);
      }
    });

    // ─────────────────────────────────────────────
    // MemberJoined Event Listener
    // ─────────────────────────────────────────────
    contract.on("MemberJoined", async (gid, member, event) => {
      console.log(`\n👤 ===== MEMBERJOINED EVENT =====`);
      console.log(`   Group ID: ${gid}`);
      console.log(`   Member: ${member}`);
      console.log(`   TX Hash: ${event.transactionHash}`);

      try {
        const savedEvent = await Event.create({
          eventType: "MemberJoined",
          gid: Number(gid),
          user: member,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
        });
        console.log("✅ MemberJoined event saved to DB");
      } catch (error) {
        console.error("❌ Error saving MemberJoined:", error.message);
      }
    });

    // ─────────────────────────────────────────────
    // BorrowerSelected Event Listener
    // ─────────────────────────────────────────────
    contract.on("BorrowerSelected", async (gid, borrower, wasTie, event) => {
      console.log(`\n💰 ===== BORROWERSELECTED EVENT =====`);
      console.log(`   Group ID: ${gid}`);
      console.log(`   Borrower: ${borrower}`);
      console.log(`   Was Tie: ${wasTie}`);
      console.log(`   TX Hash: ${event.transactionHash}`);

      try {
        const savedEvent = await Event.create({
          eventType: "BorrowerSelected",
          gid: Number(gid),
          user: borrower,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
        });
        console.log("✅ BorrowerSelected event saved to DB");
      } catch (error) {
        console.error("❌ Error saving BorrowerSelected:", error.message);
      }
    });

    isListening = true;
    console.log("\n✅ ✅ ✅ ALL EVENT LISTENERS ACTIVE ✅ ✅ ✅\n");

  } catch (error) {
    console.error("❌ Error starting event listeners:", error.message);
  }
}

module.exports = { startEventListener };