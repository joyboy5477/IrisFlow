import React from "react";
import IrisGlyph from "./IrisGlyph";

export default function ProcessingBar({ message = "Thinking" }) {
  return (
    <section className="iris-bar-shell iris-bar-processing" aria-label="Iris Flow is processing">
      <div className="iris-bar-status">
        <IrisGlyph active />
        <div className="iris-bar-copy">
          <strong>{message}</strong>
          <span>Almost there</span>
        </div>
      </div>
      <span className="iris-processing-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </section>
  );
}
