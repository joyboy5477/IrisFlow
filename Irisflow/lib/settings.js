const store = require("./store");
const secrets = require("./secrets");

const DEFAULTS = {
  aiMode: false,
  provider: "cerebras",
  cerebrasModel: "gpt-oss-120b",
  openaiModel: "gpt-4.1",
  claudeModel: "claude-sonnet-4-5",
  onboardingComplete: false,
};

const ALLOWED = new Set(Object.keys(DEFAULTS));

const MODEL_OPTIONS = {
  cerebras: [
    { id: "gpt-oss-120b", label: "gpt-oss-120b (reasoning)" },
    { id: "gemma-4-31b", label: "gemma-4-31b" },
    { id: "zai-glm-4.7", label: "zai-glm-4.7" },
  ],
  openai: [
    { id: "gpt-4.1", label: "gpt-4.1" },
    { id: "gpt-4o", label: "gpt-4o" },
    { id: "o4-mini", label: "o4-mini" },
  ],
  claude: [
    { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
    { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  ],
};

function hasKey(value) {
  const trimmed = String(value || "").trim();
  return Boolean(trimmed) && !trimmed.startsWith("your-") && trimmed !== "REPLACE_ME";
}

function readPrefs() {
  const rows = store.all("SELECT key, value FROM settings");
  const parsed = { ...DEFAULTS };
  for (const row of rows) {
    if (!ALLOWED.has(row.key)) continue;
    try {
      parsed[row.key] = JSON.parse(row.value);
    } catch {
      parsed[row.key] = row.value;
    }
  }
  return parsed;
}

function writePref(key, value) {
  store.run(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    [key, JSON.stringify(value)]
  );
}

function migrateLegacyKeys() {
  const rows = store.all("SELECT key, value FROM settings");
  const patch = {};
  for (const row of rows) {
    if (!secrets.isSecretField(row.key)) continue;
    try {
      patch[row.key] = JSON.parse(row.value);
    } catch {
      patch[row.key] = row.value;
    }
    store.run("DELETE FROM settings WHERE key = ?", [row.key]);
  }
  if (Object.keys(patch).length) secrets.write(patch);
}

function init(userDataPath) {
  secrets.init(userDataPath);
  migrateLegacyKeys();
}

function getSettings() {
  return { ...readPrefs(), ...secrets.read() };
}

function updateSettings(patch = {}) {
  const secretPatch = {};
  for (const [key, value] of Object.entries(patch)) {
    if (secrets.isSecretField(key)) {
      secretPatch[key] = value;
      continue;
    }
    if (!ALLOWED.has(key)) continue;
    writePref(key, value);
  }
  if (Object.keys(secretPatch).length) secrets.write(secretPatch);
  return getSettings();
}

function publicState(settings = getSettings()) {
  return {
    aiMode: Boolean(settings.aiMode),
    provider: settings.provider,
    cerebrasModel: settings.cerebrasModel,
    openaiModel: settings.openaiModel,
    claudeModel: settings.claudeModel,
    onboardingComplete: Boolean(settings.onboardingComplete),
    hasDeepgram: hasKey(settings.deepgramApiKey),
    hasGoogle: hasKey(settings.googleApiKey),
    hasCerebras: hasKey(settings.cerebrasApiKey),
    hasOpenai: hasKey(settings.openaiApiKey),
    hasAnthropic: hasKey(settings.anthropicApiKey),
    readyHint: !hasKey(settings.deepgramApiKey)
      ? "Add a Deepgram key in Iris Flow"
      : settings.aiMode
        ? "AI mode · Hold Ctrl"
        : "Hold Ctrl and speak",
  };
}

function providerHasKey(settings, provider = settings.provider) {
  if (provider === "openai") return hasKey(settings.openaiApiKey);
  if (provider === "claude") return hasKey(settings.anthropicApiKey);
  return hasKey(settings.cerebrasApiKey);
}

function selectedModel(settings) {
  if (settings.provider === "openai") return settings.openaiModel;
  if (settings.provider === "claude") return settings.claudeModel;
  return settings.cerebrasModel;
}

module.exports = {
  DEFAULTS,
  MODEL_OPTIONS,
  hasKey,
  init,
  getSettings,
  updateSettings,
  publicState,
  providerHasKey,
  selectedModel,
};
