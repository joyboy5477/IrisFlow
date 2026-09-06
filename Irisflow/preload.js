const { contextBridge, ipcRenderer } = require("electron");

function on(channel, cb) {
  const handler = (_event, data) => cb(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld("iris", {
  getAppState: () => ipcRenderer.invoke("get-app-state"),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  getModelOptions: () => ipcRenderer.invoke("get-model-options"),
  saveSettings: (patch) => ipcRenderer.invoke("save-settings", patch),
  getActivityLog: () => ipcRenderer.invoke("get-activity-log"),
  copyActivityLog: () => ipcRenderer.invoke("copy-activity-log"),
  getLogPath: () => ipcRenderer.invoke("get-log-path"),
  revealLogFile: () => ipcRenderer.invoke("reveal-log-file"),
  getChats: () => ipcRenderer.invoke("get-chats"),
  getResources: () => ipcRenderer.invoke("get-resources"),
  uploadResources: (files) => ipcRenderer.invoke("upload-resources", files),
  setResourceIncluded: (id, included) => ipcRenderer.invoke("set-resource-included", id, included),
  deleteResource: (id) => ipcRenderer.invoke("delete-resource", id),
  processVoice: (payload) => ipcRenderer.invoke("process-voice", payload),
  getClipboard: () => ipcRenderer.invoke("get-clipboard"),
  copyLastAnswer: () => ipcRenderer.invoke("copy-last-answer"),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  setIrisBarViewMode: (mode) => ipcRenderer.send("iris-bar-view-mode", mode),
  quit: () => ipcRenderer.send("quit-app"),

  onAppState: (cb) => on("app-state", cb),
  onActivityLog: (cb) => on("activity-log", cb),
  onChatsChanged: (cb) => on("chats-changed", cb),
  onResourcesChanged: (cb) => on("resources-changed", cb),
  onVoicePrime: (cb) => on("voice-prime", cb),
  onVoiceCancel: (cb) => on("voice-cancel", cb),
  onVoiceStart: (cb) => on("voice-start", cb),
  onVoiceStop: (cb) => on("voice-stop", cb),
  onStatus: (cb) => on("status", cb),
  onResult: (cb) => on("result", cb),
});
