const logger = require("./logger");
const { hasKey } = require("./settings");

const DEEPGRAM_URL = "https://api.deepgram.com/v1/listen";
const MODEL = "nova-3";

async function transcribe(audioBuffer, mimeType, apiKey) {
  if (!hasKey(apiKey)) {
    throw new Error("Add your Deepgram API key in the Keys tab before using voice.");
  }

  const contentType = mimeType || "audio/webm";
  const started = Date.now();
  logger.info("Deepgram request", { bytes: audioBuffer.length, contentType, model: MODEL });

  const url = new URL(DEEPGRAM_URL);
  url.searchParams.set("model", MODEL);
  url.searchParams.set("smart_format", "true");
  url.searchParams.set("punctuate", "true");
  url.searchParams.set("filler_words", "false");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey.trim()}`,
      "Content-Type": contentType,
    },
    body: audioBuffer,
  });

  const raw = await response.text();
  if (!response.ok) {
    logger.error("Deepgram failed", { status: response.status, body: raw.slice(0, 400) });
    throw new Error(`Deepgram ${response.status}: ${raw.slice(0, 180) || "request failed"}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    logger.error("Deepgram returned non-JSON", raw.slice(0, 300));
    throw new Error("Deepgram returned an unreadable response.");
  }

  const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
  if (typeof transcript !== "string" || !transcript.trim()) {
    logger.warn("Deepgram empty transcript");
    throw new Error("No speech detected. Hold Ctrl, speak clearly, then release.");
  }

  logger.info("Deepgram transcript", {
    length: transcript.trim().length,
    ms: Date.now() - started,
  });
  return transcript.trim();
}

module.exports = { transcribe };
