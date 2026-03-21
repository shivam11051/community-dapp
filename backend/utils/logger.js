const fs = require("fs");
const path = require("path");

const logsDir = path.join(__dirname, "../logs");

// Create logs directory if it doesn't exist
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const getTimestamp = () => new Date().toISOString();

const logger = {
  info: (message) => {
    const log = `[${getTimestamp()}] ℹ️ INFO: ${message}`;
    console.log(log);
    fs.appendFileSync(path.join(logsDir, "app.log"), log + "\n");
  },

  error: (message) => {
    const log = `[${getTimestamp()}] ❌ ERROR: ${message}`;
    console.error(log);
    fs.appendFileSync(path.join(logsDir, "error.log"), log + "\n");
  },

  warn: (message) => {
    const log = `[${getTimestamp()}] ⚠️ WARNING: ${message}`;
    console.warn(log);
    fs.appendFileSync(path.join(logsDir, "app.log"), log + "\n");
  },

  debug: (message) => {
    if (process.env.DEBUG === "true") {
      const log = `[${getTimestamp()}] 🐛 DEBUG: ${message}`;
      console.log(log);
      fs.appendFileSync(path.join(logsDir, "debug.log"), log + "\n");
    }
  },
};

module.exports = logger;