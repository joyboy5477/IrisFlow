const {
  app,
  BrowserWindow,
  ipcMain,
  clipboard,
  screen,
  shell,
  systemPreferences,
  nativeImage,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { exec, spawn } = require("child_process");

const logger = require("./lib/logger");
const store = require("./lib/store");
const settings = require("./lib/settings");
const rag = require("./lib/rag");
const voice = require("./lib/voice");
const cues = require("./lib/cues");
const keytap = require("./lib/keytap");

let irisBarWindow = null;
let mainWindow = null;
let keyListener = null;
let lastAnswer = "";
let irisBarViewMode = "compact";
let irisBarDisplayId = null;
let irisBarDisplayTracker = null;
let irisBarWorkspaceConfigured = false;
let accessibilitySettingsOpened = false;
let holdTimer = null;
let isVoiceRecording = false;
let ready = false;

const TRIGGER_KEY = "LEFT CTRL";
const HOLD_MS = 350;

const IRIS_BAR_BOUNDS = {
  compact: { width: 12, height: 38 },
  expanded: { width: 390, height: 66 },
  circle: { width: 168, height: 168 },
};

const IRIS_BAR_POSITION = {
  rightInset: 8,
  topInset: 84,
};

function clampPosition(value, min, max) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function getCursorDisplay() {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
}

function getIrisBarBounds(mode = irisBarViewMode) {
  return IRIS_BAR_BOUNDS[mode] || IRIS_BAR_BOUNDS.compact;
}

function keepIrisBarAboveApps({ forceWorkspace = false } = {}) {
  if (!irisBarWindow || irisBarWindow.isDestroyed()) return;
  irisBarWindow.setAlwaysOnTop(true, "screen-saver", 1);
  if (process.platform === "darwin" && (!irisBarWorkspaceConfigured || forceWorkspace)) {
    irisBarWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: irisBarWorkspaceConfigured,
    });
    irisBarWorkspaceConfigured = true;
    if (app.dock) {
      setTimeout(() => app.dock.show(), 250);
    }
  }
}

function positionIrisBar(mode = irisBarViewMode) {
  if (!irisBarWindow || irisBarWindow.isDestroyed()) return;

  const display = getCursorDisplay();
  const { width, height } = getIrisBarBounds(mode);
  const { x, y, width: displayWidth, height: displayHeight } = display.workArea;
  const compactCenterY = y + IRIS_BAR_POSITION.topInset + IRIS_BAR_BOUNDS.compact.height / 2;
  const preferredX = x + displayWidth - width - IRIS_BAR_POSITION.rightInset;
  const preferredY = compactCenterY - height / 2;
  const nextBounds = {
    width,
    height,
    x: Math.round(clampPosition(preferredX, x + 12, x + displayWidth - width - 12)),
    y: Math.round(clampPosition(preferredY, y + 12, y + displayHeight - height - 12)),
  };

  irisBarWindow.setBounds(nextBounds, false);
  irisBarDisplayId = display.id;
  keepIrisBarAboveApps();
}

function setIrisBarViewMode(mode) {
  irisBarViewMode = IRIS_BAR_BOUNDS[mode] ? mode : "compact";
  positionIrisBar(irisBarViewMode);
}

function startIrisBarDisplayTracking() {
  if (irisBarDisplayTracker) return;
  irisBarDisplayTracker = setInterval(() => {
    if (!irisBarWindow || irisBarWindow.isDestroyed()) return;
    keepIrisBarAboveApps();
    const display = getCursorDisplay();
    if (display.id !== irisBarDisplayId) {
      positionIrisBar(irisBarViewMode);
    }
  }, 800);
}

function sendToIrisBar(channel, payload) {
  if (irisBarWindow && !irisBarWindow.isDestroyed()) {
    irisBarWindow.webContents.send(channel, payload);
  }
}

function sendToMain(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function broadcastState() {
  const state = settings.publicState();
  sendToIrisBar("app-state", state);
  sendToMain("app-state", state);
}

function notifyChats() {
  sendToMain("chats-changed", {});
}

function notifyResources() {
  sendToMain("resources-changed", {});
}

function createIrisBarWindow() {
  const initialBounds = getIrisBarBounds("compact");

  irisBarWindow = new BrowserWindow({
    width: initialBounds.width,
    height: initialBounds.height,
    type: "panel",
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: true,
    acceptFirstMouse: true,
    hasShadow: false,
    roundedCorners: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  irisBarWindow.setBackgroundColor("#00000000");

  positionIrisBar("compact");
  keepIrisBarAboveApps();

  irisBarWindow.webContents.session.setPermissionRequestHandler(
    (_wc, permission, callback) => {
      callback(["media", "microphone", "audioCapture"].includes(permission));
    }
  );

  irisBarWindow.webContents.on("console-message", (_e, _level, message) => {
    logger.info(`[irisBar] ${message}`);
  });

  irisBarWindow.loadFile(path.join(__dirname, "dist", "irisBar.html"));
  irisBarWindow.showInactive();
  keepIrisBarAboveApps({ forceWorkspace: true });
  setTimeout(() => keepIrisBarAboveApps({ forceWorkspace: true }), 500);
  startIrisBarDisplayTracking();

  irisBarWindow.on("closed", () => {
    irisBarWindow = null;
    irisBarWorkspaceConfigured = false;
  });
}

function getAppIcon() {
  const iconPath = path.join(__dirname, "build", "icon.png");
  if (!fs.existsSync(iconPath)) return undefined;
  const image = nativeImage.createFromPath(iconPath);
  return image.isEmpty() ? undefined : image;
}

function applyDockIcon() {
  const icon = getAppIcon();
  if (icon && app.dock) {
    app.dock.setIcon(icon);
  }
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 860,
    minHeight: 520,
    movable: true,
    title: "Irisflow",
    icon: getAppIcon(),
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: "#f6f1e8",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function runOsa(script) {
  return new Promise((resolve, reject) => {
    exec(`osascript -e '${script}'`, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(stdout);
    });
  });
}

const sendCopy = () =>
  runOsa('tell application "System Events" to keystroke "c" using command down');
const sendPaste = () =>
  runOsa('tell application "System Events" to keystroke "v" using command down');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function insertAtCursor(text) {
  const savedClipboard = clipboard.readText();
  clipboard.writeText(text);
  lastAnswer = text;
  await wait(30);
  await sendPaste();
  await wait(80);
  clipboard.writeText(savedClipboard);
}

async function copyToClipboard(text) {
  lastAnswer = text;
  clipboard.writeText(text);
}

function getKeyServerPath() {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      "bin",
      "MacKeyServer"
    );
  }
  return path.join(__dirname, "bin", "MacKeyServer");
}

function showAccessibilityHelp() {
  if (accessibilitySettingsOpened) return;
  accessibilitySettingsOpened = true;
  sendToIrisBar("status", {
    state: "error",
    text: "Enable Irisflow in Accessibility, then quit and reopen.",
  });
  logger.warn("Accessibility permission missing", {
    packaged: app.isPackaged,
    ...keytap.snapshot(),
  });
  logger.info("Opening Accessibility settings once");
  shell.openExternal(
    "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
  );
}

function startVoiceCapture() {
  if (!irisBarWindow || irisBarWindow.isDestroyed() || isVoiceRecording) return;
  const state = settings.publicState();
  if (!state.hasDeepgram) {
    sendToIrisBar("status", {
      state: "error",
      text: "Add your Deepgram key in the Iris Flow window.",
    });
    logger.warn("Voice blocked: missing Deepgram key");
    return;
  }
  isVoiceRecording = true;
  logger.info("Voice capture started");
  cues.play("listen");
  irisBarWindow.webContents.send("voice-start", { aiMode: state.aiMode });
}

async function stopVoiceCapture() {
  if (!isVoiceRecording) return;
  isVoiceRecording = false;

  const current = settings.getSettings();
  let context = "";

  if (current.aiMode) {
    const before = clipboard.readText();
    try {
      await wait(50);
      await sendCopy();
      await wait(90);
      const after = clipboard.readText();
      if (after && after !== before) context = after;
    } catch (error) {
      logger.error("Selection capture failed", error.message);
    }
  }

  logger.info("Voice capture stopped", { contextChars: context.length, aiMode: current.aiMode });
  sendToIrisBar("voice-stop", { context });
}

function handleKeyEvent(event) {
  logger.info("Key event", { name: event.name, state: event.state });
  if (event.name === TRIGGER_KEY) {
    if (event.state === "DOWN") {
      if (holdTimer || isVoiceRecording) return;
      sendToIrisBar("voice-prime", {});
      holdTimer = setTimeout(() => {
        holdTimer = null;
        startVoiceCapture();
      }, HOLD_MS);
    } else if (event.state === "UP") {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
        sendToIrisBar("voice-cancel", {});
      }
      if (isVoiceRecording) stopVoiceCapture();
    }
  } else if (event.state === "DOWN" && holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
    sendToIrisBar("voice-cancel", {});
  }
}

function startKeyListener() {
  if (process.platform !== "darwin") {
    throw new Error("Iris Flow is currently macOS-only.");
  }

  logger.info("Starting key listener", {
    packaged: app.isPackaged,
    execPath: process.execPath,
    dylib: keytap.dylibPath(),
    helper: getKeyServerPath(),
  });

  try {
    keytap.start((event) => handleKeyEvent(event));
    logger.info("In-process key tap started", keytap.snapshot());
    let announcedReady = false;
    setTimeout(() => {
      const snap = keytap.snapshot();
      logger.info("Key tap check", snap);
      if (!snap.ready) showAccessibilityHelp();
    }, 2500);
    const waitForTap = setInterval(() => {
      if (!keytap.ready() || announcedReady) return;
      announcedReady = true;
      clearInterval(waitForTap);
      logger.info("Left-Ctrl listener is ready", keytap.snapshot());
    }, 1500);
    return;
  } catch (error) {
    logger.warn("In-process key tap unavailable, using helper", error.message);
  }

  const keyServerPath = getKeyServerPath();
  if (!fs.existsSync(keyServerPath)) {
    throw new Error(`Mac key listener helper not found: ${keyServerPath}`);
  }

  keyListener = spawn(keyServerPath, [], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let buffer = "";
  keyListener.stdout.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        handleKeyEvent(JSON.parse(line));
      } catch (error) {
        logger.error("Key listener parse failed", error.message);
      }
    }
  });

  keyListener.stderr.on("data", (chunk) => {
    const message = chunk.toString("utf8").trim();
    logger.warn(`[key-listener] ${message}`);
    if (message.includes("Accessibility permission")) {
      showAccessibilityHelp();
    }
  });

  keyListener.on("error", (err) => {
    logger.error("Failed to start key listener", err.message);
    showAccessibilityHelp();
  });

  keyListener.on("exit", (code, signal) => {
    if (code !== 0 && signal !== "SIGTERM") {
      logger.error(`Key listener exited: code=${code} signal=${signal || ""}`);
      showAccessibilityHelp();
    }
  });
}

function registerIpc() {
  ipcMain.handle("get-app-state", () => settings.publicState());
  ipcMain.handle("get-settings", () => settings.getSettings());
  ipcMain.handle("get-model-options", () => settings.MODEL_OPTIONS);
  ipcMain.handle("get-activity-log", () => logger.getEntries());
  ipcMain.handle("get-log-path", () => logger.getPath());
  ipcMain.handle("reveal-log-file", () => {
    const file = logger.getPath();
    if (file && fs.existsSync(file)) {
      shell.showItemInFolder(file);
      return { opened: true, file };
    }
    return { opened: false, file: file || "" };
  });
  ipcMain.handle("get-chats", () => voice.listChats());
  ipcMain.handle("get-resources", () => rag.listResources());
  ipcMain.handle("get-clipboard", () => clipboard.readText());
  ipcMain.handle("open-external", (_event, url) => shell.openExternal(url));

  ipcMain.handle("save-settings", (_event, patch) => {
    const next = settings.updateSettings(patch || {});
    logger.info("Settings saved", {
      aiMode: next.aiMode,
      provider: next.provider,
      hasDeepgram: settings.hasKey(next.deepgramApiKey),
      hasGoogle: settings.hasKey(next.googleApiKey),
      hasCerebras: settings.hasKey(next.cerebrasApiKey),
      hasOpenai: settings.hasKey(next.openaiApiKey),
      hasAnthropic: settings.hasKey(next.anthropicApiKey),
    });
    broadcastState();
    return { settings: next, state: settings.publicState() };
  });

  ipcMain.handle("copy-activity-log", () => {
    const text = logger
      .getEntries()
      .map((entry) => `[${entry.ts}] ${entry.level.toUpperCase()} ${entry.message}${entry.extra ? ` ${entry.extra}` : ""}`)
      .join("\n");
    clipboard.writeText(text);
    return { copied: true };
  });

  ipcMain.handle("copy-last-answer", () => {
    if (!lastAnswer) return { copied: false };
    clipboard.writeText(lastAnswer);
    return { copied: true };
  });

  ipcMain.handle("upload-resources", async (_event, files) => {
    const uploaded = await rag.uploadFiles(files || []);
    notifyResources();
    return uploaded;
  });

  ipcMain.handle("set-resource-included", (_event, id, included) => {
    const resource = rag.setIncluded(id, included);
    notifyResources();
    return resource;
  });

  ipcMain.handle("delete-resource", (_event, id) => {
    rag.deleteResource(id);
    notifyResources();
    return true;
  });

  ipcMain.handle("process-voice", async (_event, payload) => {
    const result = await voice.processVoice(payload || {}, {
      insertAtCursor,
      copyToClipboard,
    });
    cues.play(result.mode === "dictation" ? "success" : "copied");
    notifyChats();
    sendToIrisBar("result", result);
    return result;
  });

  ipcMain.on("iris-bar-view-mode", (_event, mode) => {
    setIrisBarViewMode(mode);
  });

  ipcMain.on("quit-app", () => app.quit());
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  app.setName("Irisflow");
  applyDockIcon();
  if (app.dock) app.dock.show();

  const userData = path.join(app.getPath("appData"), "Iris");
  app.setPath("userData", userData);
  logger.init(userData);
  logger.setEmitter((entry) => sendToMain("activity-log", entry));
  await store.init(userData);
  settings.init(userData);
  rag.init(userData);
  cues.init(userData);
  ready = true;
  logger.info("Local store ready", { userData });

  registerIpc();

  if (process.platform === "darwin") {
    const trusted = systemPreferences.isTrustedAccessibilityClient(true);
    logger.info("Accessibility trusted", {
      trusted,
      packaged: app.isPackaged,
      name: app.getName(),
      execPath: process.execPath,
    });
  }

  createIrisBarWindow();
  createMainWindow();
  broadcastState();

  try {
    startKeyListener();
    logger.info("Hold Left-Ctrl to speak");
  } catch (error) {
    logger.error("Key listener failed", error.message);
    sendToIrisBar("status", {
      state: "error",
      text: "Key listener failed — grant Accessibility permission and restart.",
    });
  }

  app.on("activate", () => {
    createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  if (irisBarDisplayTracker) clearInterval(irisBarDisplayTracker);
  if (keyListener && !keyListener.killed) keyListener.kill();
  if (ready) store.close();
});
