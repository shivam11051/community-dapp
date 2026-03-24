/**
 * server.js - Production-hardened Express backend (v3.0)
 *
 * NEW IN V3.0:
 *   - helmet:           secure HTTP headers
 *   - express-rate-limit: 100 req/15min per IP
 *   - .env validation:  crash early with clear error if keys missing
 *   - cronService:      auto-marks missed EMIs every hour
 */

require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const helmet     = require("helmet");
const rateLimit  = require("express-rate-limit");
const mongoose   = require("mongoose");
const logger     = require("./utils/logger");

// ── 1. ENV VALIDATION ─────────────────────────────────────────────
const REQUIRED_ENV = ["MONGODB_URI", "ALCHEMY_KEY", "CONTRACT_ADDRESS"];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error("❌ Missing required environment variables:", missing.join(", "));
  console.error("   Please create backend/.env with these values.");
  process.exit(1);
}

// ── 2. APP SETUP ──────────────────────────────────────────────────
const app = express();

// Security headers (helmet)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "10kb" }));

// Global rate limit: 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api", limiter);

// ── 3. ROUTES ─────────────────────────────────────────────────────
const groupsRouter    = require("./routes/groups");
const historyRouter   = require("./routes/history");
const investorRouter  = require("./routes/investor");
const analyticsRouter = require("./routes/analytics");
const adminRouter     = require("./routes/admin");
const usersRouter     = require("./routes/users");

app.use("/api/groups",    groupsRouter);
app.use("/api/history",   historyRouter);
app.use("/api/investor",  investorRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/admin",     adminRouter);
app.use("/api/users",     usersRouter);

// ── 4. HEALTH CHECK ───────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "✅ Backend running",
    version: "3.0.0",
    timestamp: new Date(),
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// ── 5. 404 HANDLER ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── 6. ERROR HANDLER ──────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: "Internal server error" });
});

// ── 7. DATABASE + SERVICES STARTUP ───────────────────────────────
const PORT = process.env.PORT || 5001;

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info("✅ MongoDB connected");

    // Start blockchain event listener
    const { startEventListener } = require("./services/eventListener");
    await startEventListener();
    logger.info("✅ Event listener started");

    // Start missed-EMI cron job
    const { startCronService } = require("./services/cronService");
    startCronService();
    logger.info("✅ Cron service started");

    app.listen(PORT, () => {
      logger.info(`✅ Server running on port ${PORT}`);
    });
  } catch (err) {
    logger.error(`❌ Startup failed: ${err.message}`);
    process.exit(1);
  }
}

startServer();

module.exports = app;