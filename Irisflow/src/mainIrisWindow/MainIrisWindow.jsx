import React, { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatHistory from "./components/ChatHistory";
import ResourceShelf from "./components/ResourceShelf";
import SetupKeys from "./components/SetupKeys";
import ActivityLog from "./components/ActivityLog";
import Onboarding from "./components/Onboarding";
import {
  deleteResource,
  fetchChats,
  fetchResources,
  setResourceIncluded,
  uploadResources,
} from "./services/mainWindowApi";

const EMPTY_SETTINGS = {
  deepgramApiKey: "",
  googleApiKey: "",
  cerebrasApiKey: "",
  openaiApiKey: "",
  anthropicApiKey: "",
  aiMode: false,
  provider: "cerebras",
  cerebrasModel: "gpt-oss-120b",
  openaiModel: "gpt-4.1",
  claudeModel: "claude-sonnet-4-5",
  onboardingComplete: false,
};

export default function MainIrisWindow() {
  const [activeView, setActiveView] = useState("home");
  const [chats, setChats] = useState([]);
  const [chatStatus, setChatStatus] = useState("loading");
  const [chatError, setChatError] = useState("");
  const [resources, setResources] = useState([]);
  const [resourceStatus, setResourceStatus] = useState("loading");
  const [resourceError, setResourceError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [appState, setAppState] = useState({
    aiMode: false,
    hasDeepgram: false,
    hasGoogle: false,
    readyHint: "Hold Ctrl and speak",
  });
  const [modelOptions, setModelOptions] = useState({
    cerebras: [],
    openai: [],
    claude: [],
  });
  const [keyStatus, setKeyStatus] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);

  const includedResources = useMemo(
    () => resources.filter((resource) => resource.included),
    [resources]
  );

  const loadChats = useCallback(async () => {
    try {
      const nextChats = await fetchChats();
      setChats(nextChats);
      setChatStatus("ok");
      setChatError("");
    } catch (error) {
      setChatStatus("error");
      setChatError(error.message);
    }
  }, []);

  const loadResources = useCallback(async () => {
    try {
      const nextResources = await fetchResources();
      setResources(nextResources);
      setResourceStatus("ok");
      setResourceError("");
    } catch (error) {
      setResourceStatus("error");
      setResourceError(error.message);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      window.iris.getSettings(),
      window.iris.getAppState(),
      window.iris.getModelOptions(),
    ]).then(([nextSettings, nextState, options]) => {
      if (!active) return;
      setSettings(nextSettings);
      setAppState(nextState);
      setModelOptions(options);
      setShowOnboarding(!nextSettings.onboardingComplete);
    });
    loadResources();
    const offState = window.iris.onAppState((next) => setAppState(next));
    const offResources = window.iris.onResourcesChanged(() => loadResources());
    return () => {
      active = false;
      offState && offState();
      offResources && offResources();
    };
  }, [loadResources]);

  const persist = useCallback(async (patch) => {
    setSettings((current) => ({ ...current, ...patch }));
    const result = await window.iris.saveSettings(patch);
    setAppState(result.state);
    return result;
  }, []);

  const handleUpload = useCallback(async (files) => {
    setIsUploading(true);
    setResourceError("");
    try {
      const uploaded = await uploadResources(files);
      setResources((current) => mergeResources(uploaded, current));
      setResourceStatus("ok");
    } catch (error) {
      setResourceError(error.message);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleToggleIncluded = useCallback(async (resourceId, included) => {
    setResources((current) =>
      current.map((resource) =>
        resource.id === resourceId ? { ...resource, included } : resource
      )
    );
    try {
      const updated = await setResourceIncluded(resourceId, included);
      setResources((current) =>
        current.map((resource) => (resource.id === resourceId ? updated : resource))
      );
      setResourceError("");
    } catch (error) {
      setResourceError(error.message);
      setResources((current) =>
        current.map((resource) =>
          resource.id === resourceId ? { ...resource, included: !included } : resource
        )
      );
    }
  }, []);

  const handleDeleteResource = useCallback(
    async (resourceId) => {
      const previous = resources;
      setResources((current) => current.filter((resource) => resource.id !== resourceId));
      try {
        await deleteResource(resourceId);
        setResourceError("");
      } catch (error) {
        setResourceError(error.message);
        setResources(previous);
      }
    },
    [resources]
  );

  async function handleSaveKeys() {
    await persist(settings);
    setKeyStatus("Saved on this Mac.");
    window.setTimeout(() => setKeyStatus(""), 1800);
  }

  const titles = {
    home: "Iris Flow workspace",
    resources: "Resource library",
    keys: "Keys and models",
    activity: "Activity",
  };

  return (
    <div className="iris-app">
      {showOnboarding && (
        <Onboarding
          onFinish={async () => {
            await persist({ onboardingComplete: true });
            setShowOnboarding(false);
            setActiveView("keys");
          }}
        />
      )}

      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        resourceCount={includedResources.length}
        aiMode={Boolean(appState.aiMode)}
        ready={Boolean(appState.hasDeepgram)}
      />

      <main className="main-surface">
        <header className="app-header">
          <div>
            <p className="eyebrow">Desktop AI command layer</p>
            <h1>{titles[activeView] || "Iris Flow workspace"}</h1>
          </div>
          <div className="header-summary">
            <label className={`mode-toggle${appState.aiMode ? " is-on" : ""}`}>
              <input
                type="checkbox"
                checked={Boolean(appState.aiMode)}
                onChange={(event) => persist({ aiMode: event.target.checked })}
              />
              <span>{appState.aiMode ? "AI mode" : "Dictation"}</span>
            </label>
            {appState.aiMode && (
              <>
                <select
                  className="header-select"
                  value={settings.provider}
                  onChange={(event) => persist({ provider: event.target.value })}
                >
                  <option value="cerebras">Cerebras</option>
                  <option value="openai">OpenAI</option>
                  <option value="claude">Claude</option>
                </select>
                <select
                  className="header-select"
                  value={headerModelValue(settings)}
                  onChange={(event) => persist({ [headerModelKey(settings.provider)]: event.target.value })}
                >
                  {(modelOptions[settings.provider] || []).map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            <span>{chats.length} chats</span>
            <span>{includedResources.length} resources included</span>
          </div>
        </header>

        {activeView === "home" && (
          <div className="workspace-grid">
            <ChatHistory
              chats={chats}
              status={chatStatus}
              error={chatError}
              onRefresh={loadChats}
            />
            <ResourceShelf
              resources={resources}
              isLoading={resourceStatus === "loading"}
              isUploading={isUploading}
              error={resourceError}
              onUpload={handleUpload}
              onToggleIncluded={handleToggleIncluded}
              onDelete={handleDeleteResource}
              needsGoogleKey={!appState.hasGoogle}
            />
          </div>
        )}

        {activeView === "resources" && (
          <ResourceShelf
            resources={resources}
            isLoading={resourceStatus === "loading"}
            isUploading={isUploading}
            error={resourceError}
            onUpload={handleUpload}
            onToggleIncluded={handleToggleIncluded}
            onDelete={handleDeleteResource}
            isFullPage
            needsGoogleKey={!appState.hasGoogle}
          />
        )}

        {activeView === "keys" && (
          <SetupKeys
            values={settings}
            modelOptions={modelOptions}
            onChange={(patch) => setSettings((current) => ({ ...current, ...patch }))}
            onSave={handleSaveKeys}
            status={keyStatus}
          />
        )}

        {activeView === "activity" && <ActivityLog />}
      </main>
    </div>
  );
}

function mergeResources(incoming, current) {
  const byId = new Map();
  [...incoming, ...current].forEach((resource) => byId.set(resource.id, resource));
  return Array.from(byId.values()).sort((a, b) =>
    String(b.created_at || "").localeCompare(String(a.created_at || ""))
  );
}

function headerModelKey(provider) {
  if (provider === "openai") return "openaiModel";
  if (provider === "claude") return "claudeModel";
  return "cerebrasModel";
}

function headerModelValue(values) {
  return values[headerModelKey(values.provider)] || "";
}
