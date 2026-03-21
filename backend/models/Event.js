const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  eventType: {
    type: String,
    enum: ["EMIPaid", "VoteCast", "MemberJoined", "BorrowerSelected", "GroupCreated", "LoanCompleted"],
    required: true,
    index: true,
  },
  gid: {
    type: Number,
    required: true,
    index: true,
  },
  user: {
    type: String,
    index: true,
  },
  borrower: String,
  amount: String,
  month: Number,
  lateFee: String,
  candidate: String,
  transactionHash: {
    type: String,
    unique: true,
    sparse: true,
  },
  blockNumber: Number,
  gasUsed: String,
  status: {
    type: String,
    enum: ["success", "pending", "failed"],
    default: "success",
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 7776000, // 90 days TTL
  },
});

// Indexes for fast queries
eventSchema.index({ gid: 1, timestamp: -1 });
eventSchema.index({ user: 1, timestamp: -1 });
eventSchema.index({ eventType: 1, timestamp: -1 });

module.exports = mongoose.model("Event", eventSchema);