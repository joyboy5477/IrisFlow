import React from "react";
import IrisGlyph from "./IrisGlyph";

export default function ReadyBar({ isExpanded, lastHint, onCopyLastAnswer }) {
  if (!isExpanded) {
    return <section className="iris-compact-pill" aria-label="Iris Flow" />;
  }

  return (
    <section className="iris-bar-shell iris-bar-ready" aria-label="Iris Flow ready">
      <div className="iris-bar-status">
        <IrisGlyph />
        <div className="iris-bar-copy">
          <strong>Iris Flow ready</strong>
          <span>{lastHint || "Hold Left-Ctrl and talk"}</span>
        </div>
      </div>

      <div className="iris-bar-actions">
        <button
          className="iris-copy-button"
          type="button"
          aria-label="Copy last Iris Flow answer"
          onClick={onCopyLastAnswer}
        >
          Copy
        </button>
      </div>
    </section>
  );
}
