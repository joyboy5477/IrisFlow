import React from "react";
import logo from "../../assets/icon.png";

const NAV_ITEMS = [
  { id: "home", label: "Home", glyph: "H" },
  { id: "resources", label: "Resources", glyph: "R" },
  { id: "keys", label: "Keys", glyph: "K" },
  { id: "activity", label: "Activity", glyph: "A" },
];

export default function Sidebar({ activeView, onSelectView, resourceCount, aiMode, ready }) {
  return (
    <aside className="iris-sidebar">
      <div className="iris-brand">
        <img className="iris-brand-mark" src={logo} alt="" />
        <div>
          <strong>Iris Flow</strong>
          <span>Local Mac assistant</span>
        </div>
      </div>

      <nav className="iris-nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`iris-nav-item${activeView === item.id ? " is-active" : ""}`}
            type="button"
            onClick={() => onSelectView(item.id)}
          >
            <span className="iris-nav-glyph" aria-hidden="true">
              {item.glyph}
            </span>
            <span>{item.label}</span>
            {item.id === "resources" && resourceCount > 0 && (
              <span className="iris-nav-count">{resourceCount}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="iris-sidebar-status">
        <span className={`iris-status-dot${ready ? "" : " is-warn"}`} />
        <span>{aiMode ? "AI mode" : "Dictation"}</span>
      </div>

      <div className="iris-sidebar-foot">Local · v0.2</div>
    </aside>
  );
}
