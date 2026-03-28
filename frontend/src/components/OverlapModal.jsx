// components/OverlapModal.jsx
export default function OverlapModal({ overlaps, transcripts, onSelect, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">🔁 Overlapping Topics</h2>
            <p className="modal-subtitle">
              These topics appear in multiple videos. Pick the version you want to use.
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Overlap list */}
        <div className="modal-body">
          {overlaps.map((overlap, i) => (
            <div key={i} className="overlap-block">

              {/* Topic header */}
              <div className="overlap-topic-header">
                <span className="overlap-topic-name">📌 {overlap.topic}</span>
                <span className="overlap-topic-desc">{overlap.description}</span>
              </div>

              {/* Side-by-side comparison cards */}
              <div className="overlap-cards">
                {overlap.sources.map((srcIdx, j) => (
                  <div key={j} className="overlap-card">
                    <div className="overlap-card-header">
                      <span className="overlap-card-video">
                        📹 {transcripts[srcIdx]?.title || `Video ${srcIdx + 1}`}
                      </span>
                    </div>
                    <p className="overlap-card-excerpt">
                      "{overlap.excerpts?.[j] || "No excerpt available."}"
                    </p>
                    <button
                      className="btn btn-select"
                      onClick={() => onSelect(overlap.excerpts?.[j] || "")}
                    >
                      ✅ Use this version
                    </button>
                  </div>
                ))}
              </div>

              {/* Skip option */}
              <button className="btn-skip-topic" onClick={() => onSelect("")}>
                ⏭ Skip this topic
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}