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

module.exports = router;