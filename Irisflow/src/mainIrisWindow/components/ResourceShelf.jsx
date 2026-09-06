import React, { useRef, useState } from "react";
import emptyArt from "../../assets/empty.png";

const ACCEPTED_RESOURCE_TYPES = [
  ".pdf",
  ".docx",
  ".txt",
  ".md",
  ".rtf",
  ".csv",
  ".json",
].join(",");

export default function ResourceShelf({
  resources,
  isLoading,
  isUploading,
  error,
  onUpload,
  onToggleIncluded,
  onDelete,
  isFullPage = false,
  needsGoogleKey = false,
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const includedCount = resources.filter((resource) => resource.included).length;

  function openPicker() {
    inputRef.current?.click();
  }

  function handleFiles(files) {
    if (!files || files.length === 0) return;
    onUpload(files);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  return (
    <section className={isFullPage ? "resource-workspace" : "resource-shelf"}>
      <header className="section-head">
        <div>
          <p className="eyebrow">Context Library</p>
          <h2>Resources</h2>
        </div>
        <span className="resource-count">{includedCount} included</span>
      </header>

      {needsGoogleKey && (
        <p className="resource-hint">
          Add a Google AI key in Keys so Iris Flow can embed these files for RAG.
        </p>
      )}

      <button
        className={`resource-dropzone${isDragging ? " is-dragging" : ""}`}
        type="button"
        onClick={openPicker}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <span className="resource-plus" aria-hidden="true">
          +
        </span>
        <strong>{isUploading ? "Indexing..." : "Add resources"}</strong>
        <span>PDF, DOCX, TXT, Markdown, CSV</span>
      </button>

      <input
        ref={inputRef}
        className="resource-file-input"
        type="file"
        accept={ACCEPTED_RESOURCE_TYPES}
        multiple
        onChange={(event) => handleFiles(event.target.files)}
      />

      {error && <p className="resource-error">{error}</p>}

      <div className="resource-list" aria-live="polite">
        {isLoading && <p className="muted">Loading resources...</p>}

        {!isLoading && resources.length === 0 && (
          <div className="resource-empty">
            <img className="iris-empty-art" src={emptyArt} alt="" />
            <strong>No resources yet</strong>
            <span>Add files Iris Flow should search when AI mode is on.</span>
          </div>
        )}

        {!isLoading &&
          resources.map((resource) => (
            <article className="resource-item" key={resource.id}>
              <div className="resource-file-mark">{fileLabel(resource.filename)}</div>
              <div className="resource-body">
                <div className="resource-row">
                  <strong title={resource.filename}>{resource.filename}</strong>
                  <button
                    className={`include-toggle${resource.included ? " is-on" : ""}`}
                    type="button"
                    onClick={() => onToggleIncluded(resource.id, !resource.included)}
                    aria-pressed={resource.included}
                  >
                    {resource.included ? "Included" : "Include"}
                  </button>
                  <button
                    className="remove-resource"
                    type="button"
                    onClick={() => onDelete(resource.id)}
                    aria-label={`Remove ${resource.filename}`}
                  >
                    Remove
                  </button>
                </div>
                <span>
                  {formatBytes(resource.size_bytes)} · {resource.kind || "file"}
                  {resource.extraction_status ? ` · ${statusLabel(resource.extraction_status)}` : ""}
                </span>
                {resource.preview && <p>{resource.preview}</p>}
              </div>
            </article>
          ))}
      </div>
    </section>
  );
}

function fileLabel(filename = "") {
  const ext = filename.split(".").pop();
  return (ext || "file").slice(0, 4).toUpperCase();
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status) {
  if (status === "done") return "indexed";
  if (status === "needs_google_key") return "needs Google key";
  if (status === "failed") return "index failed";
  if (status === "unsupported") return "unsupported type";
  if (status === "empty") return "no text found";
  return status;
}
