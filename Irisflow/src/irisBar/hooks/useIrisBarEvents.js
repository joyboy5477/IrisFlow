import { useEffect } from "react";
import { getIrisBridge } from "../services/irisBarBridge";

export default function useIrisBarEvents({
  onVoicePrime,
  onVoiceCancel,
  onVoiceStart,
  onVoiceStop,
  onStatus,
  onResult,
}) {
  useEffect(() => {
    const bridge = getIrisBridge();
    const unsubscribe = [
      bridge.onVoicePrime(onVoicePrime),
      bridge.onVoiceCancel(onVoiceCancel),
      bridge.onVoiceStart(onVoiceStart),
      bridge.onVoiceStop(onVoiceStop),
      bridge.onStatus(onStatus),
      bridge.onResult(onResult),
    ].filter(Boolean);

    return () => {
      unsubscribe.forEach((fn) => fn());
    };
  }, [onVoicePrime, onVoiceCancel, onVoiceStart, onVoiceStop, onStatus, onResult]);
}
