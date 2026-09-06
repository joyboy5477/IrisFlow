const path = require("path");
const logger = require("./logger");

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;
const PLAIN = new Set([".txt", ".md", ".csv", ".json"]);

function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  if (normalized.length <= chunkSize) return [normalized];

  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    chunks.push(normalized.slice(start, end));
    if (end >= normalized.length) break;
    start = end - overlap;
  }
  return chunks;
}

function extractRtf(buffer) {
  const text = buffer.toString("utf8");
  return text
    .replace(/\\[a-zA-Z]+-?\d* ?/g, " ")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractPdf(buffer) {
  let pdfParse;
  try {
    pdfParse = require("pdf-parse/lib/pdf-parse.js");
  } catch {
    pdfParse = require("pdf-parse");
  }
  const result = await pdfParse(buffer);
  return String(result.text || "").trim();
}

async function extractDocx(buffer) {
  const mammoth = require("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return String(result.value || "").trim();
}

async function extractText(buffer, filename) {
  const ext = path.extname(filename || "").toLowerCase();
  try {
    if (ext === ".pdf") return await extractPdf(buffer);
    if (ext === ".docx") return await extractDocx(buffer);
    if (PLAIN.has(ext)) return buffer.toString("utf8");
    if (ext === ".rtf") return extractRtf(buffer);
    if (ext === ".doc") return null;
  } catch (error) {
    logger.error("Text extraction failed", { filename, ext, error: error.message });
    return null;
  }
  return null;
}

function previewOf(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > 240 ? `${clean.slice(0, 240)}…` : clean;
}

function kindOf(filename) {
  const ext = path.extname(filename || "").toLowerCase().replace(".", "");
  return ext || "file";
}

module.exports = {
  chunkText,
  extractText,
  previewOf,
  kindOf,
};
