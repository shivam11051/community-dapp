const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  logger.error(`Error: ${err.message} | Path: ${req.path}`);

  const status = err.status || 500;
  const message = err.message || "Internal server error";

  res.status(status).json({
    status: "❌ Error",
    message,
    path: req.path,
    timestamp: new Date(),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;