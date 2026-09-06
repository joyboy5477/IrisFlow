const koffi = require("koffi");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const logger = require("./logger");

let lib = null;

function dylibPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app.asar.unpacked", "bin", "libiriskeys.dylib");
  }
  return path.join(__dirname, "..", "bin", "libiriskeys.dylib");
}

function load() {
  if (lib) return lib;
  const file = dylibPath();
  logger.info("Loading key tap library", {
    file,
    exists: fs.existsSync(file),
    packaged: app.isPackaged,
  });
  if (!fs.existsSync(file)) {
    throw new Error(`Key listener library not found: ${file}`);
  }
  const dylib = koffi.load(file);
  lib = {
    start: dylib.func("void iris_keys_start()"),
    ready: dylib.func("int iris_keys_ready()"),
    ax: dylib.func("int iris_keys_ax()"),
    status: dylib.func("void iris_keys_status(char *buf, int n)"),
    poll: dylib.func("int iris_keys_poll(char *buf, int n)"),
  };
  logger.info("Key tap library loaded");
  return lib;
}

function start(onEvent) {
  const keys = load();
  keys.start();
  logger.info("Key tap start requested", snapshot());
  const buf = Buffer.alloc(128);
  const pollTimer = setInterval(() => {
    if (keys.poll(buf, buf.length) !== 1) return;
    const text = buf.toString("utf8").replace(/\0.*$/, "").trim();
    if (!text) return;
    try {
      onEvent(JSON.parse(text));
    } catch (error) {
      logger.warn("Key tap poll parse failed", { text, error: error.message });
    }
  }, 20);
  const retryTimer = setInterval(() => {
    if (keys.ready() === 1) {
      clearInterval(retryTimer);
      return;
    }
    keys.start();
  }, 2000);
  return { pollTimer, retryTimer };
}

function ready() {
  try {
    return load().ready() === 1;
  } catch (error) {
    logger.warn("Key tap ready check failed", error.message);
    return false;
  }
}

function snapshot() {
  try {
    const keys = load();
    const buf = Buffer.alloc(64);
    keys.status(buf, buf.length);
    return {
      ready: keys.ready() === 1,
      ax: keys.ax() === 1,
      nativeStatus: buf.toString("utf8").replace(/\0.*$/, "").trim(),
    };
  } catch (error) {
    return { ready: false, ax: false, nativeStatus: error.message };
  }
}

module.exports = { start, ready, snapshot, dylibPath };
