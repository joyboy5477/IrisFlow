const crypto = require("crypto");
const store = require("./store");
const logger = require("./logger");
const { getSettings, hasKey, providerHasKey } = require("./settings");
const { transcribe } = require("./stt");
const { getAnswer } = require("./llm");
const rag = require("./rag");

function listChats(limit = 100) {
  return store.all(
    "SELECT * FROM chats ORDER BY created_at DESC LIMIT ?",
    [limit]
  );
}

function saveChat({ source, mode, question, answer, context = "" }) {
  store.run(
    `INSERT INTO chats (id, source, mode, question, answer, context, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      source,
      mode,
      question || "",
      answer || "",
      context || "",
      new Date().toISOString(),
    ]
  );
}

function toBuffer(audio) {
  if (!audio) throw new Error("Audio payload was empty.");
  if (typeof audio === "string") return Buffer.from(audio, "base64");
  if (Buffer.isBuffer(audio)) return audio;
  if (audio instanceof ArrayBuffer) return Buffer.from(audio);
  if (audio instanceof Uint8Array) return Buffer.from(audio);
  if (Array.isArray(audio)) return Buffer.from(audio);
  if (audio.type === "Buffer" && Array.isArray(audio.data)) return Buffer.from(audio.data);
  throw new Error("Audio payload was empty.");
}

async function processVoice({ audio, mimeType, context }, actions) {
  const settings = getSettings();
  if (!hasKey(settings.deepgramApiKey)) {
    throw new Error("Add your Deepgram API key in the Keys tab first.");
  }

  const started = Date.now();
  const buffer = toBuffer(audio);
  if (!buffer.length) throw new Error("No audio captured.");

  logger.info("Voice captured", {
    bytes: buffer.length,
    aiMode: settings.aiMode,
    hasContext: Boolean(context),
  });

  const sttStarted = Date.now();
  const transcript = await transcribe(buffer, mimeType, settings.deepgramApiKey);
  const sttMs = Date.now() - sttStarted;

  if (!settings.aiMode) {
    const pasteStarted = Date.now();
    await actions.insertAtCursor(transcript);
    const timing = {
      sttMs,
      pasteMs: Date.now() - pasteStarted,
      totalMs: Date.now() - started,
    };
    saveChat({
      source: "voice",
      mode: "dictation",
      question: transcript,
      answer: transcript,
    });
    logger.info("Voice latency", timing);
    return {
      mode: "dictation",
      transcript,
      answer: transcript,
      message: "It's in",
      timing,
    };
  }

  if (!providerHasKey(settings)) {
    throw new Error("AI mode is on. Add a Cerebras, OpenAI, or Claude key, and pick that provider.");
  }

  const trimmedContext = String(context || "").trim();
  const fused = trimmedContext
    ? `Here is some text I copied:\n"""\n${trimmedContext}\n"""\n\nMy spoken request about it: ${transcript}`
    : transcript;

  const canSearch = rag.includedChunkCount() > 0;
  const llmStarted = Date.now();
  const answer = await getAnswer(fused, settings, canSearch ? rag.searchFn : null);
  const llmMs = Date.now() - llmStarted;
  await actions.copyToClipboard(answer);
  const timing = {
    sttMs,
    llmMs,
    totalMs: Date.now() - started,
  };
  saveChat({
    source: "voice",
    mode: "ai",
    question: transcript,
    answer,
    context: trimmedContext,
  });
  logger.info("Voice latency", timing);
  return {
    mode: "ai",
    transcript,
    answer,
    message: "Copied — paste with ⌘V",
    timing,
  };
}

module.exports = {
  listChats,
  saveChat,
  processVoice,
};
