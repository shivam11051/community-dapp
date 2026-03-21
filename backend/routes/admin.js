const express = require("express");
const router = express.Router();
const logger = require("../utils/logger");

const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS || "0xfe6fdb2d1b213400272fa50f993d9c61bb885ac0";

// ─────────────────────────────────────────────
// Admin verification
// ─────────────────────────────────────────────
router.get("/check/:address", (req, res) => {
  try {
    const { address } = req.params;
    const isAdmin = address.toLowerCase() === ADMIN_ADDRESS.toLowerCase();

    logger.info(`Admin check for ${address}: ${isAdmin}`);

    res.json({
      status: "✅",
      address,
      isAdmin,
      timestamp: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// Admin stats
// ─────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const Group = require("../models/Group");
    const Event = require("../models/Event");

    const totalGroups = await Group.countDocuments();
    const activeGroups = await Group.countDocuments({ status: 1 });
    const totalEvents = await Event.countDocuments();

    res.json({
      status: "✅",
      data: {
        totalGroups,
        activeGroups,
        totalEvents,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;