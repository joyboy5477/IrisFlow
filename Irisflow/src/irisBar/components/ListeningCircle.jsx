import React from "react";
import IrisGlyph from "./IrisGlyph";

export default function ListeningCircle({ isPriming = false }) {
  return (
    <section className="iris-listening-stage" aria-label="Iris Flow is listening">
      <div className="iris-listening-orbit">
        <div className="iris-listening-core">
          <IrisGlyph active />
          <strong>{isPriming ? "Hold" : "I'm listening"}</strong>
        </div>
      </div>
    </section>
  );
}
