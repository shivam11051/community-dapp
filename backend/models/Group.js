const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
  gid: {
    type: Number,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: String,
  creator: {
    type: String,
    required: true,
    index: true,
  },
  status: {
    type: Number,
    enum: [0, 1, 2, 3], // PENDING, OPEN, ACTIVE, CLOSED
    default: 0,
    index: true,
  },
  contribution: String,
  maxSize: Number,
  tenure: Number,
  isPrivate: Boolean,
  memberCount: Number,
  totalPool: String,
  fillDeadline: Date,
  profitPool: String,

  // Phase 5: Investor data
  trustScore: Number,
  metrics: {
    fillPercentage: Number,
    activeLoan: Boolean,
    completedLoans: Number,
  },
  health: {
    fillPercentage: Number,
    averageCreditScore: Number,
    onTimeMemberCount: Number,
    defaultedMemberCount: Number,
  },
  roi: {
    principalReturned: String,
    profitEarned: String,
    roiPercentage: Number,
    defaultRate: Number,
  },

  members: [String],
  loan: {
    active: Boolean,
    borrower: String,
    principal: String,
    monthsPaid: Number,
  },

  syncedAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
groupSchema.index({ creator: 1, createdAt: -1 });
groupSchema.index({ status: 1, createdAt: -1 });
groupSchema.index({ "metrics.fillPercentage": -1 });

module.exports = mongoose.model("Group", groupSchema);