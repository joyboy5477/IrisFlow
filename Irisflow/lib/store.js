const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  mode TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  context TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  content_type TEXT,
  kind TEXT,
  size_bytes INTEGER,
  included INTEGER NOT NULL DEFAULT 1,
  preview TEXT,
  extraction_status TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding TEXT NOT NULL
);
`;

let db = null;
let dbPath = "";
let persistTimer = null;

function persistNow() {
  if (!db || !dbPath) return;
  const data = Buffer.from(db.export());
  fs.writeFileSync(dbPath, data);
}

function persist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistNow();
  }, 40);
}

function run(sql, params = []) {
  db.run(sql, params);
  persist();
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  return all(sql, params)[0] || null;
}

async function init(userDataPath) {
  const sqlDir = path.dirname(require.resolve("sql.js"));
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(sqlDir, file),
  });

  dbPath = path.join(userDataPath, "iris.db");
  fs.mkdirSync(userDataPath, { recursive: true });

  if (fs.existsSync(dbPath)) {
    const file = fs.readFileSync(dbPath);
    db = new SQL.Database(file);
  } else {
    db = new SQL.Database();
  }

  db.run(SCHEMA);
  persistNow();
  return db;
}

function close() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  persistNow();
}

module.exports = {
  init,
  close,
  run,
  all,
  get,
  persistNow,
};
