import React, { useEffect, useState } from "react";

export default function ActivityLog() {
  const [entries, setEntries] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    window.iris.getActivityLog().then((list) => {
      if (active) setEntries(list || []);
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
        <button className="secondary-action" type="button" onClick={copyAll}>
          {copied ? "Copied" : "Copy log"}
        </button>
      </header>

      <p className="muted">
        Mic, Deepgram, models, and paste timing land here. Look for <strong>Voice latency</strong> after
        each hold — that is the real wait after you release Control. API keys are redacted.
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
