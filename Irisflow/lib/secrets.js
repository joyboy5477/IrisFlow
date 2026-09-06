const fs = require("fs");
const path = require("path");
const { safeStorage } = require("electron");

const SECRET_FIELDS = [
  "deepgramApiKey",
  "googleApiKey",
  "cerebrasApiKey",
  "openaiApiKey",
  "anthropicApiKey",
];

const SECRET_SET = new Set(SECRET_FIELDS);

let filePath = "";
let cache = {
  deepgramApiKey: "",
  googleApiKey: "",
  cerebrasApiKey: "",
  openaiApiKey: "",
  anthropicApiKey: "",
};

function init(userDataPath) {
  filePath = path.join(userDataPath, "secrets.enc");
  cache = { ...cache, ...load() };
}

function load() {
  if (!filePath || !fs.existsSync(filePath)) return {};
  try {
    const raw = fs.readFileSync(filePath);
    if (!raw.length) return {};
    let text;
    if (safeStorage.isEncryptionAvailable()) {
      text = safeStorage.decryptString(raw);
    } else {
      text = raw.toString("utf8");
    }
    const parsed = JSON.parse(text);
    const out = {};
    for (const field of SECRET_FIELDS) {
      out[field] = typeof parsed[field] === "string" ? parsed[field] : "";
    }
    return out;
  } catch {
    return {};
  }
}

function persist() {
  if (!filePath) return;
  const payload = JSON.stringify(cache);
  const encoded = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(payload)
    : Buffer.from(payload, "utf8");
  fs.writeFileSync(filePath, encoded, { mode: 0o600 });
}

function read() {
  return { ...cache };
}

function write(patch = {}) {
  let changed = false;
  for (const [key, value] of Object.entries(patch)) {
    if (!SECRET_SET.has(key)) continue;
    cache[key] = String(value || "");
    changed = true;
  }
  if (changed) persist();
  return read();
}

function isSecretField(key) {
  return SECRET_SET.has(key);
}

module.exports = {
  SECRET_FIELDS,
  init,
  read,
  write,
  isSecretField,
};
