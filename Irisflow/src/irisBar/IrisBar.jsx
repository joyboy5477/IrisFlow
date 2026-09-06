import React, { useCallback, useEffect, useRef, useState } from "react";
import ReadyBar from "./components/ReadyBar";
import ListeningCircle from "./components/ListeningCircle";
import ProcessingBar from "./components/ProcessingBar";
import ErrorBar from "./components/ErrorBar";
import useIrisBarEvents from "./hooks/useIrisBarEvents";
import useVoiceRecorder from "./hooks/useVoiceRecorder";
import { requestVoiceAssist } from "./services/irisBarApi";
import { getIrisBridge } from "./services/irisBarBridge";
import { ERROR_RESET_MS, IRIS_BAR_STATUS, SUCCESS_RESET_MS } from "./constants";

const HOVER_COLLAPSE_MS = 450;

export default function IrisBar() {
  const bridge = getIrisBridge();
  const contextRef = useRef("");
  const resetTimerRef = useRef(null);
  const hoverCollapseTimerRef = useRef(null);
  const [status, setStatus] = useState(IRIS_BAR_STATUS.READY);
  const [readyHint, setReadyHint] = useState("Hold Ctrl and speak");
  const [message, setMessage] = useState("Hold Ctrl and speak");
  const [isExpanded, setIsExpanded] = useState(false);

  const clearHoverCollapse = useCallback(() => {
    window.clearTimeout(hoverCollapseTimerRef.current);
    hoverCollapseTimerRef.current = null;
  }, []);

  const scheduleReady = useCallback(
    (delay) => {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = window.setTimeout(() => {
        setStatus(IRIS_BAR_STATUS.READY);
        setMessage(readyHint);
        setIsExpanded(false);
      }, delay);
    },
    [readyHint]
  );

  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    bridge.getAppState?.().then((state) => {
      if (!state?.readyHint) return;
      setReadyHint(state.readyHint);
      if (statusRef.current === IRIS_BAR_STATUS.READY) setMessage(state.readyHint);
    });
    const off = bridge.onAppState?.((state) => {
      if (!state?.readyHint) return;
      setReadyHint(state.readyHint);
      if (statusRef.current === IRIS_BAR_STATUS.READY) setMessage(state.readyHint);
    });
    return () => off && off();
  }, [bridge]);

  const fail = useCallback(
    (error) => {
      const nextMessage = error?.message || String(error) || "Something went wrong";
      setStatus(IRIS_BAR_STATUS.ERROR);
      setMessage(nextMessage);
      scheduleReady(ERROR_RESET_MS);
    },
    [scheduleReady]
  );

  const submitVoice = useCallback(
    async (audioBlob) => {
      setStatus(IRIS_BAR_STATUS.PROCESSING);
      setMessage("Writing it down");
      try {
        const data = await requestVoiceAssist({
          audioBlob,
          context: contextRef.current,
        });
        const done =
          data.message ||
          (data.mode === "dictation" ? "It's in" : "Copied — paste with ⌘V");
        setMessage(timingHint(done, data.timing));
        setStatus(IRIS_BAR_STATUS.SUCCESS);
        scheduleReady(SUCCESS_RESET_MS);
      } catch (error) {
        fail(error);
      }
    },
    [fail, scheduleReady]
  );

  const { startRecording, stopRecording, discardRecording } = useVoiceRecorder({
    onBlob: submitVoice,
    onError: (error) => {
      fail(new Error(error?.message || "Microphone access blocked"));
    },
  });

  useEffect(() => {
    if (status === IRIS_BAR_STATUS.PRIMING || status === IRIS_BAR_STATUS.LISTENING) {
      bridge.setIrisBarViewMode("circle");
      return;
    }

    if (
      status === IRIS_BAR_STATUS.PROCESSING ||
      status === IRIS_BAR_STATUS.ERROR ||
      isExpanded
    ) {
      bridge.setIrisBarViewMode("expanded");
      return;
    }

    bridge.setIrisBarViewMode("compact");
  }, [bridge, isExpanded, status]);

  const beginPrompt = useCallback(async () => {
    setStatus(IRIS_BAR_STATUS.PRIMING);
    setMessage("I'm listening");
    await startRecording();
  }, [startRecording]);

  const endPrompt = useCallback(
    (context = contextRef.current) => {
      contextRef.current = context || "";
      setStatus(IRIS_BAR_STATUS.PROCESSING);
      setMessage("Writing it down");
      stopRecording();
    },
    [stopRecording]
  );

  const handleCopyLastAnswer = useCallback(async () => {
    const result = await bridge.copyLastAnswer();
    if (result && result.copied) {
      setStatus(IRIS_BAR_STATUS.SUCCESS);
      setMessage("Last answer copied");
      scheduleReady(SUCCESS_RESET_MS);
      return;
    }

    setStatus(IRIS_BAR_STATUS.ERROR);
    setMessage("Nothing to copy yet");
    scheduleReady(ERROR_RESET_MS);
  }, [bridge, scheduleReady]);

  const expandOnHover = useCallback(() => {
    if (status === IRIS_BAR_STATUS.READY || status === IRIS_BAR_STATUS.SUCCESS) {
      clearHoverCollapse();
      setIsExpanded(true);
    }
  }, [clearHoverCollapse, status]);

  const collapseAfterHover = useCallback(() => {
    if (status === IRIS_BAR_STATUS.READY || status === IRIS_BAR_STATUS.SUCCESS) {
      clearHoverCollapse();
      hoverCollapseTimerRef.current = window.setTimeout(() => {
        setIsExpanded(false);
      }, HOVER_COLLAPSE_MS);
    }
  }, [clearHoverCollapse, status]);

  useEffect(() => {
    return () => {
      window.clearTimeout(resetTimerRef.current);
      clearHoverCollapse();
    };
  }, [clearHoverCollapse]);

  useIrisBarEvents({
    onVoicePrime: useCallback(() => {
      window.clearTimeout(resetTimerRef.current);
      clearHoverCollapse();
      setIsExpanded(false);
      contextRef.current = "";
      beginPrompt();
    }, [beginPrompt, clearHoverCollapse]),
    onVoiceCancel: useCallback(() => {
      discardRecording();
      setStatus(IRIS_BAR_STATUS.READY);
      setMessage(readyHint);
      setIsExpanded(false);
    }, [discardRecording, readyHint]),
    onVoiceStart: useCallback(() => {
      setStatus(IRIS_BAR_STATUS.LISTENING);
      setMessage("I'm listening");
    }, []),
    onVoiceStop: useCallback(
      (data) => {
        endPrompt((data && data.context) || "");
      },
      [endPrompt]
    ),
    onStatus: useCallback((data) => {
      setStatus(data?.state === "error" ? IRIS_BAR_STATUS.ERROR : IRIS_BAR_STATUS.PROCESSING);
      setMessage(data?.text || "Working");
      if (data?.state === "error") scheduleReady(ERROR_RESET_MS);
    }, [scheduleReady]),
    onResult: useCallback(() => {}, []),
  });

  return (
    <main
      className={`iris-bar-root is-${status}`}
      onPointerEnter={expandOnHover}
      onPointerLeave={collapseAfterHover}
    >
      {(status === IRIS_BAR_STATUS.PRIMING || status === IRIS_BAR_STATUS.LISTENING) && (
        <ListeningCircle isPriming={status === IRIS_BAR_STATUS.PRIMING} />
      )}
      {status === IRIS_BAR_STATUS.PROCESSING && <ProcessingBar message={message} />}
      {status === IRIS_BAR_STATUS.ERROR && <ErrorBar message={message} />}
      {(status === IRIS_BAR_STATUS.READY || status === IRIS_BAR_STATUS.SUCCESS) && (
        <ReadyBar
          isExpanded={isExpanded}
          lastHint={message}
          onCopyLastAnswer={handleCopyLastAnswer}
        />
      )}
    </main>
  );
}

function timingHint(message, timing) {
  const total = Number(timing?.totalMs);
  if (!total || total < 1) return message;
  const seconds = total >= 1000 ? `${(total / 1000).toFixed(1)}s` : `${total}ms`;
  return `${message} · ${seconds}`;
}
