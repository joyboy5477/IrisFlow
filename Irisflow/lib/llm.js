const logger = require("./logger");
const { selectedModel, providerHasKey } = require("./settings");

const MAX_TOOL_ROUNDS = 1;
const MAX_TOKENS = 16000;

const SEARCH_RESOURCES_TOOL = {
  type: "function",
  function: {
    name: "search_resources",
    description:
      "Search the user's uploaded resources (PDFs, documents, notes, resumes, etc.) for content relevant to a query. Call this proactively for ANY request that could plausibly be about the user's own background or personal details. If the search comes back empty, fall back to answering normally.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A short, specific description of what to look for.",
        },
      },
      required: ["query"],
    },
  },
};

const ANTHROPIC_TOOL = {
  name: "search_resources",
  description: SEARCH_RESOURCES_TOOL.function.description,
  input_schema: SEARCH_RESOURCES_TOOL.function.parameters,
};

const SYSTEM_PROMPT =
  "You are Iris Flow, a concise system-wide assistant on the user's Mac. " +
  "Answer directly. Output only the response the user can paste — no preamble, no quotes, no markdown fences. " +
  "Keep formatting clean: short paragraphs, lists when useful, and preserve meaning from selected text.";

const TOOL_NOTE =
  " You have a search_resources tool for the user's uploaded files. Use it when the request could refer to those files.";

function parseToolArgs(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function runSearch(searchFn, query) {
  if (!query) return "No search query provided.";
  logger.info("LLM tool search_resources", { query });
  return searchFn(query);
}

async function completeOpenAICompat({ url, apiKey, model, messages, useTools, extra = {}, searchFn }) {
  const body = {
    model,
    messages,
    temperature: 0.3,
    max_tokens: MAX_TOKENS,
    ...extra,
  };
  if (useTools) body.tools = [SEARCH_RESOURCES_TOOL];

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  if (!response.ok) {
    logger.error("LLM request failed", { status: response.status, body: raw.slice(0, 500), model });
    throw new Error(`Model ${model} failed (${response.status}): ${raw.slice(0, 180)}`);
  }

  const data = JSON.parse(raw);
  const message = data?.choices?.[0]?.message;
  if (!message) throw new Error(`Model ${model} returned no message.`);

  const toolCalls = message.tool_calls || [];
  if (useTools && toolCalls.length && searchFn) {
    const nextMessages = messages.concat({
      role: "assistant",
      content: message.content || null,
      tool_calls: toolCalls,
    });
    for (const call of toolCalls) {
      const args = parseToolArgs(call.function?.arguments);
      const result = await runSearch(searchFn, (args.query || "").trim());
      nextMessages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result,
      });
    }
    return completeOpenAICompat({
      url,
      apiKey,
      model,
      messages: nextMessages,
      useTools: false,
      extra,
      searchFn,
    });
  }

  const content = (message.content || "").trim();
  if (!content) {
    throw new Error(`Model ${model} returned no text. Try another model or lower load.`);
  }
  return content;
}

async function completeAnthropic({ apiKey, model, userText, system, useTools, searchFn }) {
  const body = {
    model,
    max_tokens: MAX_TOKENS,
    temperature: 0.3,
    system,
    messages: [{ role: "user", content: userText }],
  };
  if (useTools) body.tools = [ANTHROPIC_TOOL];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  if (!response.ok) {
    logger.error("Claude request failed", { status: response.status, body: raw.slice(0, 500), model });
    throw new Error(`Claude ${response.status}: ${raw.slice(0, 180)}`);
  }

  const data = JSON.parse(raw);
  const blocks = data.content || [];
  const toolUse = blocks.find((block) => block.type === "tool_use" && block.name === "search_resources");

  if (useTools && toolUse && searchFn) {
    const result = await runSearch(searchFn, String(toolUse.input?.query || "").trim());
    const follow = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        temperature: 0.3,
        system,
        messages: [
          { role: "user", content: userText },
          { role: "assistant", content: blocks },
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: result,
              },
            ],
          },
        ],
      }),
    });
    const followRaw = await follow.text();
    if (!follow.ok) {
      throw new Error(`Claude tool follow-up ${follow.status}: ${followRaw.slice(0, 180)}`);
    }
    const followData = JSON.parse(followRaw);
    const text = (followData.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!text) throw new Error("Claude returned no text after searching your files.");
    return text;
  }

  const text = blocks
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("Claude returned no text.");
  return text;
}

async function getAnswer(text, settings, searchFn) {
  if (!providerHasKey(settings)) {
    throw new Error("Add an API key for the selected AI provider in the Keys tab.");
  }

  const system = searchFn ? SYSTEM_PROMPT + TOOL_NOTE : SYSTEM_PROMPT;
  const model = selectedModel(settings);
  const useTools = Boolean(searchFn);
  logger.info("LLM start", { provider: settings.provider, model, tools: useTools });

  if (settings.provider === "openai") {
    return completeOpenAICompat({
      url: "https://api.openai.com/v1/chat/completions",
      apiKey: settings.openaiApiKey.trim(),
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: text },
      ],
      useTools,
      searchFn,
    });
  }

  if (settings.provider === "claude") {
    return completeAnthropic({
      apiKey: settings.anthropicApiKey.trim(),
      model,
      userText: text,
      system,
      useTools,
      searchFn,
    });
  }

  return completeOpenAICompat({
    url: "https://api.cerebras.ai/v1/chat/completions",
    apiKey: settings.cerebrasApiKey.trim(),
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: text },
    ],
    useTools,
    extra: { reasoning_effort: "high" },
    searchFn,
  });
}

module.exports = { getAnswer };
