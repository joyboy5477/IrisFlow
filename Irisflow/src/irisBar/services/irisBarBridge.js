const fallbackBridge = {
  processVoice: async () => {
    throw new Error("Iris bridge unavailable");
  },
  copyLastAnswer: async () => ({ copied: false }),
  setIrisBarViewMode: () => {},
  getAppState: async () => ({ readyHint: "Hold Ctrl and speak" }),
  onAppState: () => () => {},
  onVoicePrime: () => () => {},
  onVoiceCancel: () => () => {},
  onVoiceStart: () => () => {},
  onVoiceStop: () => () => {},
  onStatus: () => () => {},
  onResult: () => () => {},
};

export function getIrisBridge() {
  return window.iris || fallbackBridge;
}
