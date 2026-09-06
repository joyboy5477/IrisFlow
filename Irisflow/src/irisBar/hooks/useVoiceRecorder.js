import { useRef, useState } from "react";

const MIC_IDLE_MS = 45000;

function preferredMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
    return "";
  }
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

export default function useVoiceRecorder({ onBlob, onError }) {
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const isRecordingRef = useRef(false);
  const discardRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const idleTimerRef = useRef(null);
  const mimeRef = useRef("");
  const [isRecording, setIsRecording] = useState(false);

  const stopTracks = () => {
    if (!streamRef.current) return;
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const scheduleIdleRelease = () => {
    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      if (!isRecordingRef.current) stopTracks();
    }, MIC_IDLE_MS);
  };

  const ensureStream = async () => {
    window.clearTimeout(idleTimerRef.current);
    if (streamRef.current && streamRef.current.active) return streamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    streamRef.current = stream;
    return stream;
  };

  const startRecording = async () => {
    if (isRecordingRef.current) return;
    isRecordingRef.current = true;
    discardRef.current = false;
    stopRequestedRef.current = false;

    try {
      const stream = await ensureStream();
      if (discardRef.current || stopRequestedRef.current) {
        isRecordingRef.current = false;
        setIsRecording(false);
        scheduleIdleRelease();
        return;
      }
      const mimeType = preferredMimeType();
      mimeRef.current = mimeType;
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        mediaRecorderRef.current = null;
        const discarded = discardRef.current;
        const blob = new Blob(chunksRef.current, {
          type: mimeRef.current || recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        setIsRecording(false);
        isRecordingRef.current = false;
        scheduleIdleRelease();
        if (discarded || !blob.size) return;
        onBlob(blob);
      };

      recorder.start(80);
      setIsRecording(true);
    } catch (error) {
      isRecordingRef.current = false;
      setIsRecording(false);
      stopTracks();
      onError(error);
    }
  };

  const stopRecording = () => {
    stopRequestedRef.current = true;
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    discardRef.current = false;
    recorder.stop();
  };

  const discardRecording = () => {
    const recorder = mediaRecorderRef.current;
    discardRef.current = true;
    isRecordingRef.current = false;
    setIsRecording(false);
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }
    scheduleIdleRelease();
  };

  return {
    isRecording,
    isRecordingRef,
    startRecording,
    stopRecording,
    discardRecording,
  };
}
