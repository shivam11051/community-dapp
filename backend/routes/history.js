const express = require("express");
const router = express.Router();
const Event = require("../models/Event");
const logger = require("../utils/logger");

// ─────────────────────────────────────────────
// GET events for a group
// ─────────────────────────────────────────────
router.get("/:gid", async (req, res) => {
  try {
    const { gid } = req.params;
    const { limit = 100, skip = 0, type } = req.query;

    let query = Event.find({ gid: Number(gid) });

    if (type) {
      query = query.where("eventType").equals(type);
    }

    const total = await Event.countDocuments(query.getFilter());
    const events = await query
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .lean();

    res.json({
      status: "✅",
      count: events.length,
      total,
      data: events,
    });
  } catch (error) {
    logger.error(`Error fetching history: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET all events (global)
// ─────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { limit = 100, skip = 0, type } = req.query;

    let query = Event.find();

    if (type) {
      query = query.where("eventType").equals(type);
    }

    const total = await Event.countDocuments(query.getFilter());
    const events = await query
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .lean();

    res.json({
      status: "✅",
      count: events.length,
      total,
      data: events,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;