const fs = require("fs");
const path = require("path");

const MAX_ENTRIES = 400;
const MAX_LOG_BYTES = 1_500_000;

const KEYISH = /(sk-ant-|sk-|dg-|gsk_|AIza)[A-Za-z0-9_\-]{8,}/g;

let logPath = "";
let emit = () => {};
const entries = [];
let seq = 0;

function redact(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value).replace(KEYISH, "[redacted]");
    } catch {
      return "[unserializable]";
    }
  }
  return String(value).replace(KEYISH, "[redacted]");
}

function rotateIfNeeded() {
  try {
    if (!logPath || !fs.existsSync(logPath)) return;
    const size = fs.statSync(logPath).size;
    if (size < MAX_LOG_BYTES) return;
    const backup = `${logPath}.1`;
    if (fs.existsSync(backup)) fs.unlinkSync(backup);
    fs.renameSync(logPath, backup);
  } catch {
    // keep going even if rotation fails
  }
}

function appendFile(line) {
  if (!logPath) return;
  try {
    rotateIfNeeded();
    fs.appendFileSync(logPath, line);
  } catch {
    // ignore disk errors
  }
}

function push(level, message, extra) {
  const entry = {
    id: `${Date.now()}-${++seq}`,
    ts: new Date().toISOString(),
    level,
    message: redact(message),
    extra: extra == null ? "" : redact(extra),
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
  appendFile(`[${entry.ts}] ${level.toUpperCase()} ${entry.message}${entry.extra ? ` ${entry.extra}` : ""}\n`);
  try {
    emit(entry);
  } catch {
    // renderer may not be ready
  }
  return entry;
}

function init(userDataPath) {
  logPath = path.join(userDataPath, "iris.log");
  fs.mkdirSync(userDataPath, { recursive: true });
  appendFile(`\n--- Iris Flow started ${new Date().toISOString()} ---\n`);
  push("info", "Logger ready", { file: logPath });
}

function setEmitter(fn) {
  emit = typeof fn === "function" ? fn : () => {};
}

function getEntries() {
  return entries.slice();
}

function getPath() {
  return logPath;
}

module.exports = {
  init,
  setEmitter,
  getEntries,
  getPath,
  info: (message, extra) => push("info", message, extra),
  warn: (message, extra) => push("warn", message, extra),
  error: (message, extra) => push("error", message, extra),
};
