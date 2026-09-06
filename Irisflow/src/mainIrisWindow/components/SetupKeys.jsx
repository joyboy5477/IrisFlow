import React, { useState } from "react";

const KEY_FIELDS = [
  {
    id: "deepgramApiKey",
    label: "Deepgram",
    hint: "Required for speech-to-text.",
    href: "https://console.deepgram.com/",
  },
  {
    id: "googleApiKey",
    label: "Google AI",
    hint: "Required to embed uploaded documents for RAG.",
    href: "https://aistudio.google.com/apikey",
  },
  {
    id: "cerebrasApiKey",
    label: "Cerebras",
    hint: "Default AI provider. High reasoning is used automatically.",
    href: "https://cloud.cerebras.ai/",
  },
  {
    id: "openaiApiKey",
    label: "OpenAI",
    hint: "Optional. Used when OpenAI is selected.",
    href: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropicApiKey",
    label: "Claude (Anthropic)",
    hint: "Optional. Used when Claude is selected.",
    href: "https://console.anthropic.com/settings/keys",
  },
];

export default function SetupKeys({
  values,
  modelOptions,
  onChange,
  onSave,
  status,
}) {
  const [visible, setVisible] = useState({});
  const provider = values.provider || "cerebras";
  const models = modelOptions[provider] || [];

  return (
    <section className="keys-workspace">
      <header className="section-head">
        <div>
          <p className="eyebrow">Your credentials</p>
          <h2>API keys</h2>
        </div>
        <button className="secondary-action" type="button" onClick={onSave}>
          Save keys
        </button>
      </header>

      <p className="keys-intro">
        Keys are encrypted with macOS Keychain on this computer. They are never
        written into the project folder, so they cannot be committed or included in a pull request.
      </p>

      <div className="keys-grid">
        {KEY_FIELDS.map((field) => (
          <label className="key-field" key={field.id}>
            <span>
              {field.label}
              <button
                className="key-link"
                type="button"
                onClick={() => window.iris.openExternal(field.href)}
              >
                Get key
              </button>
            </span>
            <div className="key-input-row">
              <input
                type={visible[field.id] ? "text" : "password"}
                value={values[field.id] || ""}
                autoComplete="off"
                spellCheck="false"
                onChange={(event) => onChange({ [field.id]: event.target.value })}
              />
              <button
                className="ghost-action"
                type="button"
                onClick={() =>
                  setVisible((current) => ({ ...current, [field.id]: !current[field.id] }))
                }
              >
                {visible[field.id] ? "Hide" : "Show"}
              </button>
            </div>
            <em>{field.hint}</em>
          </label>
        ))}
      </div>

      <div className="model-card">
        <p className="eyebrow">AI provider</p>
        <div className="model-row">
          <label>
            Provider
            <select
              value={provider}
              onChange={(event) => onChange({ provider: event.target.value })}
            >
              <option value="cerebras">Cerebras</option>
              <option value="openai">OpenAI</option>
              <option value="claude">Claude</option>
            </select>
          </label>
          <label>
            Model
            <select
              value={modelValue(values, provider)}
              onChange={(event) =>
                onChange({ [modelKey(provider)]: event.target.value })
              }
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">
          Cerebras runs with high reasoning so it can follow longer spoken tasks.
        </p>
      </div>

      {status && <p className="keys-status">{status}</p>}
    </section>
  );
}

function modelKey(provider) {
  if (provider === "openai") return "openaiModel";
  if (provider === "claude") return "claudeModel";
  return "cerebrasModel";
}

function modelValue(values, provider) {
  return values[modelKey(provider)] || "";
}
