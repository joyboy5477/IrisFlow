const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const store = require("./store");
const logger = require("./logger");
const { getSettings, hasKey } = require("./settings");
const { chunkText, extractText, previewOf, kindOf } = require("./extract");

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";
const EMBED_DIM = 768;
const MAX_INPUT_CHARS = 20000;
const MAX_RESOURCE_BYTES = 25 * 1024 * 1024;
const TOP_K = 5;

let resourcesDir = "";

function init(userDataPath) {
  resourcesDir = path.join(userDataPath, "resources");
  fs.mkdirSync(resourcesDir, { recursive: true });
}

function toNodeBuffer(bytes) {
  if (Buffer.isBuffer(bytes)) return bytes;
  if (bytes instanceof Uint8Array) return Buffer.from(bytes);
  if (Array.isArray(bytes)) return Buffer.from(bytes);
  if (bytes?.type === "Buffer" && Array.isArray(bytes.data)) return Buffer.from(bytes.data);
  throw new Error("File payload was empty.");
}

function normalize(vec) {
  let norm = 0;
  for (const x of vec) norm += x * x;
  norm = Math.sqrt(norm);
  if (!norm) return vec;
  return vec.map((x) => x / norm);
}

function cosine(a, b) {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

async function embed(text, taskType, apiKey) {
  if (!hasKey(apiKey)) {
    throw new Error("Add your Google AI API key in Keys to index documents.");
  }

  const response = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey.trim())}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text: String(text || "").slice(0, MAX_INPUT_CHARS) }] },
      taskType,
      outputDimensionality: EMBED_DIM,
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    logger.error("Gemini embed failed", { status: response.status, body: raw.slice(0, 400) });
    throw new Error(`Google embeddings ${response.status}`);
  }

  const data = JSON.parse(raw);
  const values = data?.embedding?.values;
  if (!Array.isArray(values) || !values.length) {
    throw new Error("Google embeddings returned an empty vector.");
  }
  return normalize(values);
}

function rowToResource(row) {
  return {
    id: row.id,
    filename: row.filename,
    stored_path: row.stored_path,
    content_type: row.content_type,
    kind: row.kind,
    size_bytes: row.size_bytes,
    included: Boolean(row.included),
    preview: row.preview,
    extraction_status: row.extraction_status,
    created_at: row.created_at,
  };
}

function listResources() {
  return store
    .all("SELECT * FROM resources ORDER BY created_at DESC")
    .map(rowToResource);
}

function getResource(id) {
  const row = store.get("SELECT * FROM resources WHERE id = ?", [id]);
  return row ? rowToResource(row) : null;
}

async function indexResource(resourceId, text, apiKey) {
  store.run("DELETE FROM chunks WHERE resource_id = ?", [resourceId]);
  const chunks = chunkText(text);
  if (!chunks.length) {
    store.run("UPDATE resources SET extraction_status = ? WHERE id = ?", ["empty", resourceId]);
    return "empty";
  }

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embed(chunks[i], "RETRIEVAL_DOCUMENT", apiKey);
    store.run(
      "INSERT INTO chunks (id, resource_id, chunk_index, content, embedding) VALUES (?, ?, ?, ?, ?)",
      [crypto.randomUUID(), resourceId, i, chunks[i], JSON.stringify(embedding)]
    );
  }
  store.run("UPDATE resources SET extraction_status = ? WHERE id = ?", ["done", resourceId]);
  logger.info("Indexed resource", { resourceId, chunks: chunks.length });
  return "done";
}

async function uploadFiles(payloads) {
  const settings = getSettings();
  const uploaded = [];

  for (const file of payloads) {
    const bytes = toNodeBuffer(file.bytes);
    if (bytes.length > MAX_RESOURCE_BYTES) {
      throw new Error(`${file.name} is larger than 25 MB.`);
    }

    const id = crypto.randomUUID();
    const safeName = String(file.name || "file").replace(/[^\w.\-]+/g, "_");
    const storedPath = path.join(resourcesDir, `${id}-${safeName}`);
    fs.writeFileSync(storedPath, bytes);

    const text = await extractText(bytes, file.name);
    const preview = previewOf(text);
    let status = text ? "pending" : "unsupported";

    store.run(
      `INSERT INTO resources
        (id, filename, stored_path, content_type, kind, size_bytes, included, preview, extraction_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        id,
        file.name || safeName,
        storedPath,
        file.type || "",
        kindOf(file.name),
        bytes.length,
        preview,
        status,
        new Date().toISOString(),
      ]
    );

    if (text && hasKey(settings.googleApiKey)) {
      try {
        status = await indexResource(id, text, settings.googleApiKey);
      } catch (error) {
        logger.error("RAG index failed", { file: file.name, error: error.message });
        store.run("UPDATE resources SET extraction_status = ? WHERE id = ?", ["failed", id]);
        status = "failed";
      }
    } else if (text && !hasKey(settings.googleApiKey)) {
      store.run("UPDATE resources SET extraction_status = ? WHERE id = ?", ["needs_google_key", id]);
      status = "needs_google_key";
    }

    uploaded.push({ ...getResource(id), extraction_status: status });
  }

  return uploaded;
}

function setIncluded(id, included) {
  store.run("UPDATE resources SET included = ? WHERE id = ?", [included ? 1 : 0, id]);
  return getResource(id);
}

function deleteResource(id) {
  const resource = getResource(id);
  if (!resource) return false;
  store.run("DELETE FROM chunks WHERE resource_id = ?", [id]);
  store.run("DELETE FROM resources WHERE id = ?", [id]);
  try {
    if (resource.stored_path && fs.existsSync(resource.stored_path)) {
      fs.unlinkSync(resource.stored_path);
    }
  } catch (error) {
    logger.warn("Could not delete stored file", error.message);
  }
  return true;
}

async function searchResources(query, topK = TOP_K) {
  const settings = getSettings();
  if (!hasKey(settings.googleApiKey)) {
    return [];
  }

  const included = store.all("SELECT id FROM resources WHERE included = 1");
  if (!included.length) return [];

  const ids = included.map((row) => row.id);
  const placeholders = ids.map(() => "?").join(",");
  const rows = store.all(
    `SELECT c.content, c.embedding, r.filename
     FROM chunks c
     JOIN resources r ON r.id = c.resource_id
     WHERE c.resource_id IN (${placeholders})`,
    ids
  );
  if (!rows.length) return [];

  const queryEmbedding = await embed(query, "RETRIEVAL_QUERY", settings.googleApiKey);
  const ranked = rows
    .map((row) => {
      let embedding = [];
      try {
        embedding = JSON.parse(row.embedding);
      } catch {
        embedding = [];
      }
      return {
        filename: row.filename,
        content: row.content,
        similarity: cosine(queryEmbedding, embedding),
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  logger.info("RAG search", { queryLength: query.length, hits: ranked.length });
  return ranked;
}

function includedChunkCount() {
  const row = store.get(
    `SELECT COUNT(*) AS n
     FROM chunks c
     JOIN resources r ON r.id = c.resource_id
     WHERE r.included = 1`
  );
  return Number(row?.n || 0);
}

async function searchFn(query) {
  try {
    const results = await searchResources(query, TOP_K);
    if (!results.length) {
      return "No relevant content found in the user's uploaded resources.";
    }
    return results
      .map(
        (item) =>
          `From "${item.filename}" (similarity ${item.similarity.toFixed(2)}):\n${item.content}`
      )
      .join("\n\n");
  } catch (error) {
    logger.error("search_resources failed", error.message);
    return "Resource search is currently unavailable.";
  }
}

module.exports = {
  init,
  listResources,
  uploadFiles,
  setIncluded,
  deleteResource,
  searchResources,
  searchFn,
  includedChunkCount,
};
