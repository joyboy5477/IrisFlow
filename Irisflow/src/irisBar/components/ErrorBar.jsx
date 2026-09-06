import React from "react";

export default function ErrorBar({ message }) {
  return (
    <section className="iris-bar-shell iris-bar-error" aria-label="Iris Flow error">
      <div className="iris-error-mark" aria-hidden="true">
        !
      </div>
      <div className="iris-bar-copy">
        <strong>Needs attention</strong>
        <span>{message}</span>
      </div>
    </section>
  );
}
