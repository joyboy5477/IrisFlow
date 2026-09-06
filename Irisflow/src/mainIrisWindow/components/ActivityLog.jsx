import React, { useEffect, useState } from "react";

export default function ActivityLog() {
  const [entries, setEntries] = useState([]);
  const [copied, setCopied] = useState(false);
  const [logPath, setLogPath] = useState("");

  useEffect(() => {
    let active = true;
    window.iris.getActivityLog().then((list) => {
      if (active) setEntries(list || []);
    });
    window.iris.getLogPath?.().then((file) => {
      if (active && file) setLogPath(file);
    });
    const off = window.iris.onActivityLog((entry) => {
      setEntries((current) => [...current, entry].slice(-400));
    });
    return () => {
      active = false;
      off && off();
    };
  }, []);

  async function copyAll() {
    await window.iris.copyActivityLog();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="activity-workspace">
      <header className="section-head">
        <div>
          <p className="eyebrow">Debug</p>
          <h2>Activity</h2>
        </div>
        <div className="activity-actions">
          <button className="secondary-action" type="button" onClick={() => window.iris.revealLogFile?.()}>
            Open log file
          </button>
          <button className="secondary-action" type="button" onClick={copyAll}>
            {copied ? "Copied" : "Copy log"}
          </button>
        </div>
      </header>

      <p className="muted">
        Mic, Deepgram, models, Left-Ctrl, Accessibility, and paste timing land here. If the bar
        does not react to Control, look for <strong>Key event</strong> and{" "}
        <strong>Left-Ctrl listener is ready</strong>. API keys are redacted.
        {logPath ? (
          <>
            {" "}
            File: <code>{logPath}</code>
          </>
        ) : null}
      </p>

      <div className="activity-list">
        {entries.length === 0 && (
          <div className="empty-state">
            <strong>No events yet</strong>
            <span>Hold Left-Ctrl or save keys to see activity.</span>
          </div>
        )}
        {entries
          .slice()
          .reverse()
          .map((entry) => (
            <article
              className={`activity-row is-${entry.level}${
                entry.message === "Voice latency" ? " is-latency" : ""
              }`}
              key={entry.id}
            >
              <span>{formatTime(entry.ts)}</span>
              <strong>{entry.level}</strong>
              <p>
                {entry.message}
                {entry.extra ? ` ${entry.extra}` : ""}
              </p>
            </article>
          ))}
      </div>
    </section>
  );
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}
