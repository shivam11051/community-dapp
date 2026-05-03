const express = require("express");
const router = express.Router();
const Event = require("../models/Event");
const logger = require("../utils/logger");

// Validation helper for pagination
function validatePagination(limit, skip) {
  const validatedLimit = Math.min(Math.max(Number(limit) || 100, 1), 200); // 1-200
  const validatedSkip = Math.max(Number(skip) || 0, 0); // >= 0
  return { validatedLimit, validatedSkip };
}

// ─────────────────────────────────────────────
// GET events for a group
// ─────────────────────────────────────────────
router.get("/:gid", async (req, res) => {
  try {
    const { gid } = req.params;
    const { limit = 100, skip = 0, type } = req.query;

    // Validate gid
    const groupId = Number(gid);
    if (isNaN(groupId) || groupId <= 0) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

    // Validate pagination
    const { validatedLimit, validatedSkip } = validatePagination(limit, skip);

    // Validate type if provided
    const validEventTypes = [
      "GroupCreated", "MemberJoined", "LoanReleased", "EMIPaid",
      "ProfitWithdrawn", "EmergencyRequested", "KickRaised", "VotingStarted"
    ];
    if (type && !validEventTypes.includes(type)) {
      return res.status(400).json({ error: "Invalid event type" });
    }

    let query = Event.find({ gid: groupId });

    if (type) {
      query = query.where("eventType").equals(type);
    }

    const total = await Event.countDocuments(query.getFilter());
    const events = await query
      .sort({ timestamp: -1 })
      .limit(validatedLimit)
      .skip(validatedSkip)
      .lean();

    res.json({
      status: "✅",
      count: events.length,
      total,
      limit: validatedLimit,
      skip: validatedSkip,
      data: events,
    });
  } catch (error) {
    logger.error(`Error fetching history for group: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET all events (global)
// ─────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { limit = 100, skip = 0, type } = req.query;

    // Validate pagination
    const { validatedLimit, validatedSkip } = validatePagination(limit, skip);

    // Validate type if provided
    const validEventTypes = [
      "GroupCreated", "MemberJoined", "LoanReleased", "EMIPaid",
      "ProfitWithdrawn", "EmergencyRequested", "KickRaised", "VotingStarted"
    ];
    if (type && !validEventTypes.includes(type)) {
      return res.status(400).json({ error: "Invalid event type" });
    }

    let query = Event.find();

    if (type) {
      query = query.where("eventType").equals(type);
    }

    const total = await Event.countDocuments(query.getFilter());
    const events = await query
      .sort({ timestamp: -1 })
      .limit(validatedLimit)
      .skip(validatedSkip)
      .lean();

    res.json({
      status: "✅",
      count: events.length,
      total,
      limit: validatedLimit,
      skip: validatedSkip,
      data: events,
    });
  } catch (error) {
    logger.error(`Error fetching global history: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET Etherscan logs (CORS proxy)
// ─────────────────────────────────────────────
router.get("/etherscan/logs/:address", async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: "Invalid contract address" });
    }

    const apiKey = process.env.ETHERSCAN_API_KEY || "";
    
    // Build the API URL without "latest" - use specific blocks instead
    // Get current block first, then query with actual block numbers
    let apiUrl = `https://sepolia.etherscan.io/api?module=logs&action=getLogs&address=${address}&fromBlock=0&toBlock=99999999`;
    if (apiKey) {
      apiUrl += `&apikey=${apiKey}`;
    }
    
    console.log(`📡 [BACKEND] Calling Etherscan: ${apiUrl}`);
    logger.info(`📡 Calling Etherscan: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    const data = await response.json();

    console.log(`📊 [BACKEND] Etherscan response:`, JSON.stringify(data).substring(0, 300));
    logger.info(`📊 Etherscan response: ${JSON.stringify(data).substring(0, 200)}`);

    res.json(data);
  } catch (error) {
    console.error(`❌ [BACKEND] Error:`, error.message);
    logger.error(`Error fetching Etherscan logs: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;