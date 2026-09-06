import React from "react";

export default function IrisGlyph({ active = false }) {
  return (
    <span className={"iris-glyph" + (active ? " is-active" : "")} aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}
