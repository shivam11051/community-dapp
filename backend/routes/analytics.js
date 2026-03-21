const express = require("express");
const router = express.Router();
const Group = require("../models/Group");
const Event = require("../models/Event");

// ─────────────────────────────────────────────
// Dashboard analytics
// ─────────────────────────────────────────────
router.get("/dashboard", async (req, res) => {
  try {
    const totalGroups = await Group.countDocuments();
    const activeGroups = await Group.countDocuments({ status: 1 });
    const closedGroups = await Group.countDocuments({ status: 3 });

    const totalEvents = await Event.countDocuments();
    const emiEvents = await Event.countDocuments({ eventType: "EMIPaid" });
    const voteEvents = await Event.countDocuments({ eventType: "VoteCast" });
    const memberEvents = await Event.countDocuments({ eventType: "MemberJoined" });

    // Calculate totals from groups
    const groupData = await Group.find().lean();
    const totalPool = groupData.reduce((sum, g) => {
      const pool = parseInt(g.totalPool || 0);
      return sum + pool;
    }, 0);

    const averageCreditScore = Math.round(
      groupData.reduce((sum, g) => sum + (g.health?.averageCreditScore || 50), 0) / totalGroups
    );

    res.json({
      status: "✅",
      data: {
        groups: {
          total: totalGroups,
          active: activeGroups,
          closed: closedGroups,
        },
        events: {
          total: totalEvents,
          emiPayments: emiEvents,
          votes: voteEvents,
          newMembers: memberEvents,
        },
        metrics: {
          totalPool,
          averageCreditScore,
          avgGroupSize: Math.round(
            groupData.reduce((sum, g) => sum + (g.memberCount || 0), 0) / totalGroups
          ),
        },
        timestamp: new Date(),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;