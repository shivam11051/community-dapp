const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

// Services & Middleware
const { startEventListener } = require("./services/eventListener");
const { initContractService } = require("./services/contractService");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./utils/logger");

// Routes
const groupRoutes = require("./routes/groups");
const historyRoutes = require("./routes/history");
const adminRoutes = require("./routes/admin");
const investorRoutes = require("./routes/investor");
const userRoutes = require("./routes/users");
const analyticsRoutes = require("./routes/analytics");

const app = express();
const PORT = process.env.PORT || 5001;

// ─────────────────────────────────────────────
// CORS Configuration
// ─────────────────────────────────────────────
const corsOptions = {
  origin: ["http://localhost:3000", "http://localhost:3001"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// ─────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "✅ Backend running",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

// ─────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────
app.use("/api/groups", groupRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/investor", investorRoutes);
app.use("/api/users", userRoutes);
app.use("/api/analytics", analyticsRoutes);

// ─────────────────────────────────────────────
// MongoDB Connection
// ─────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/community-dapp", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => logger.info("✅ MongoDB connected"))
.catch(err => logger.error("❌ MongoDB connection failed:", err.message));

// ─────────────────────────────────────────────
// Initialize Services
// ─────────────────────────────────────────────
(async () => {
  try {
    logger.info("🚀 Initializing services...");
    
    // Initialize contract service
    const contractReady = await initContractService();
    if (contractReady) {
      logger.info("✅ Contract service initialized");
    }
    
    // Start event listener
    startEventListener();
    logger.info("✅ Event listener started");
    
  } catch (error) {
    logger.error("❌ Service initialization failed:", error.message);
  }
})();

// ─────────────────────────────────────────────
// Error Handler (Last Middleware)
// ─────────────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ 
    error: "❌ Route not found",
    path: req.path,
    method: req.method
  });
});

// ─────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 Backend running on http://localhost:${PORT}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  logger.info(`🔗 Contract: ${process.env.CONTRACT_ADDRESS}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("🛑 Shutting down gracefully...");
  mongoose.connection.close();
  process.exit(0);
});

module.exports = app;