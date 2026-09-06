import React, { useEffect, useState } from "react";
import emptyArt from "../../assets/empty.png";

export default function ChatHistory({ chats, status, error, onRefresh }) {
  useEffect(() => {
    onRefresh();
    const off = window.iris?.onChatsChanged?.(() => onRefresh());
    return () => off && off();
  }, [onRefresh]);

  return (
    <section className="history-workspace">
      <header className="section-head history-section-head">
        <div>
          <p className="eyebrow">Recent Output</p>
          <h2>Chat history</h2>
        </div>
        <button className="secondary-action" type="button" onClick={onRefresh}>
          Refresh
        </button>
      </header>

      {status === "loading" && <p className="muted">Loading chats...</p>}

      {status === "error" && (
        <p className="surface-message">Could not load local history ({error}).</p>
      )}

      {status === "ok" && chats.length === 0 && (
        <div className="empty-state">
          <img className="iris-empty-art" src={emptyArt} alt="" />
          <strong>No chats yet</strong>
          <span>Hold Left-Ctrl, speak, and release. Dictation inserts text; AI mode copies an answer.</span>
        </div>
      )}

      {status === "ok" && chats.length > 0 && (
        <div className="chat-list">
          {chats.map((chat) => (
            <ChatCard chat={chat} key={chat.id} />
          ))}
        </div>
      )}
    </section>
  );
}

function ChatCard({ chat }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const answer = chat.answer || "";
  const isLong = answer.length > 560;
  const visibleAnswer = !isLong || isExpanded ? answer : `${answer.slice(0, 560)}...`;

  return (
    <article className="chat-card">
      <div className="chat-row">
        <span className="chat-tag">You</span>
        <p>{chat.question}</p>
      </div>
      <div className="chat-row">
        <span className="chat-tag chat-tag-ai">Iris Flow</span>
        <p>{visibleAnswer}</p>
      </div>

      <footer className="chat-meta">
        <span>{chat.mode}</span>
        <span>{formatTime(chat.created_at)}</span>
        {isLong && (
          <button type="button" onClick={() => setIsExpanded((value) => !value)}>
            {isExpanded ? "Show less" : "Show more"}
          </button>
        )}
      </footer>
    </article>
  );
}

function formatTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
