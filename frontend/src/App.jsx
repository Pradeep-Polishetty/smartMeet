import { useState, useRef } from "react";
import { marked } from "marked";
import "./App.css";

const API = "http://localhost:5000";

/* ─── tiny sub-components baked in ───────────────────────────────────── */

function CodeInput({ code, setCode }) {
  return (
    <div className="field-row">
      <span className="options-label">HTML / Code Input</span>
      <textarea
        className="mono-textarea code-textarea"
        rows={12}
        placeholder="Paste HTML here, or send it from Step 02 above…"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
    </div>
  );
}

function Options({ title, setTitle, style, setStyle }) {
  return (
    <div className="options-row">
      <div className="input-group">
        <span className="options-label">Document Title</span>
        <input
          className="text-input"
          placeholder="My Project Docs"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="input-group">
        <span className="options-label">Style</span>
        <select value={style} onChange={(e) => setStyle(e.target.value)}>
          <option value="technical">Technical</option>
          <option value="narrative">Narrative</option>
          <option value="concise">Concise</option>
          <option value="academic">Academic</option>
        </select>
      </div>
    </div>
  );
}

function PromptBox({ prompt, setPrompt }) {
  return (
    <div className="field-row">
      <span className="options-label">Custom Instructions (optional)</span>
      <textarea
        className="mono-textarea"
        rows={3}
        placeholder="e.g. Focus on API endpoints only, include code examples…"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
    </div>
  );
}

function GenerateButton({ loading, generateDoc }) {
  return (
    <button className="generate-btn" onClick={generateDoc} disabled={loading}>
      {loading
        ? <><span className="spinner" /> Generating Documentation…</>
        : <><span>⚡</span> Generate Documentation</>}
    </button>
  );
}

function Status({ status }) {
  if (!status.message) return null;
  return (
    <div className={`status status-${status.type}`}>
      {status.message}
    </div>
  );
}

function Preview({ preview, previewText, setPreviewText, refinementPrompt, setRefinementPrompt, onRefine, refineLoading }) {
  const [editMode, setEditMode] = useState(false);

  if (!preview) return null;

  const htmlContent = marked(previewText || preview);

  return (
    <div className="preview-container">
      <div className="preview-header">
        <span className="preview-label">✦ Generated Documentation</span>
        <button
          className="btn btn-secondary"
          style={{ padding: "6px 12px", fontSize: "0.78rem" }}
          onClick={() => setEditMode(!editMode)}
        >
          {editMode ? "👁 Preview" : "✏️ Edit"}
        </button>
      </div>

      {editMode ? (
        <textarea
          className="mono-textarea"
          rows={20}
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
        />
      ) : (
        <div 
          className="preview-box"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      )}

      <div className="refinement-row">
        <textarea
          className="refinement-input"
          rows={2}
          placeholder="Refine: Add examples, include best practices, make it more concise, add usage instructions, focus on API details, etc…"
          value={refinementPrompt}
          onChange={(e) => setRefinementPrompt(e.target.value)}
        />
        <button
          className="btn btn-secondary"
          onClick={onRefine}
          disabled={refineLoading}
          style={{ flexShrink: 0 }}
        >
          {refineLoading ? <><span className="spinner" /> Refining…</> : "✨ Refine"}
        </button>
      </div>
    </div>
  );
}

function OverlapModal({ overlaps, transcripts, onSelect, onClose }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>🔍 Overlapping Topics Detected</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {overlaps.map((overlap, i) => (
            <div
              className="overlap-item"
              key={i}
              onClick={() => onSelect(overlap.excerpt)}
            >
              <div className="overlap-topic">{overlap.topic}</div>
              {overlap.excerpt && (
                <div className="overlap-excerpt">"{overlap.excerpt}"</div>
              )}
              {overlap.videoIds && (
                <div className="overlap-videos">
                  {overlap.videoIds.map((id) => {
                    const vid = transcripts.find((t) => t.id === id);
                    return vid ? (
                      <span className="overlap-tag" key={id}>{vid.title}</span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main App ────────────────────────────────────────────────────────── */

export default function App() {
  // ── CodeDoc ─────────────────────────────────────────
  const [code, setCode]       = useState("");
  const [title, setTitle]     = useState("");
  const [style, setStyle]     = useState("technical");
  const [prompt, setPrompt]   = useState("");
  const [preview, setPreview] = useState("");
  const [status, setStatus]   = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  // ── Video / Transcript ──────────────────────────────
  const [videoFile, setVideoFile]           = useState(null);
  const [transcript, setTranscript]         = useState("");
  const [videoTitle, setVideoTitle]         = useState("");
  const [videoLoading, setVideoLoading]     = useState(false);
  const [transcriptList, setTranscriptList] = useState([]);

  // ── HTML from transcript ────────────────────────────
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [htmlMode, setHtmlMode]           = useState("preview");
  const [htmlLoading, setHtmlLoading]     = useState(false);

  // ── Overlap detection ───────────────────────────────
  const [overlaps, setOverlaps]               = useState([]);
  const [showOverlapModal, setShowOverlapModal] = useState(false);
  const [overlapLoading, setOverlapLoading]   = useState(false);

  // ── Documentation refinement ────────────────────────
  const [previewText, setPreviewText]         = useState("");
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [refineLoading, setRefineLoading]     = useState(false);

  const codeDocRef = useRef(null);

  // 1. Upload video → transcript
  const uploadVideo = async () => {
    if (!videoFile) { alert("Please select a video file first"); return; }
    setVideoLoading(true);
    setTranscript("");
    setGeneratedHtml("");
    const formData = new FormData();
    formData.append("video", videoFile);
    try {
      const res  = await fetch(`${API}/video-to-text`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTranscript(data.transcript);
      setTranscriptList(prev => [
        ...prev,
        { id: Date.now(), title: videoTitle || videoFile.name, text: data.transcript },
      ]);
    } catch (err) {
      alert("Transcription failed: " + err.message);
    } finally {
      setVideoLoading(false);
    }
  };

  // 2. Transcript → HTML
  const generateHtml = async () => {
    if (!transcript.trim()) { alert("Transcribe a video first"); return; }
    setHtmlLoading(true);
    setGeneratedHtml("");
    setHtmlMode("preview");
    try {
      const res  = await fetch(`${API}/transcript-to-html`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, title: videoTitle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGeneratedHtml(data.html);
    } catch (err) {
      alert("HTML generation failed: " + err.message);
    } finally {
      setHtmlLoading(false);
    }
  };

  // 3. Send HTML → CodeDoc input
  const sendToCodeDoc = () => {
    setCode(generatedHtml);
    setTitle(videoTitle || title);
    codeDocRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // 4. Generate documentation
  const generateDoc = async () => {
    if (!code.trim()) {
      setStatus({ type: "error", message: "⚠ Paste or generate HTML code first" });
      return;
    }
    const isHTML = /<[a-z][\s\S]*>/i.test(code);
    if (!isHTML) {
      setStatus({ type: "error", message: "⚠ Please provide valid HTML (no tags detected)" });
      return;
    }
    setLoading(true);
    setStatus({ type: "loading", message: "⏳ Analysing HTML and generating docs…" });
    try {
      const res  = await fetch(`${API}/generate-doc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, style, title, prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreview(data.result);
      setPreviewText(data.result);
      setStatus({ type: "success", message: "✅ Documentation generated!" });
    } catch (err) {
      setStatus({ type: "error", message: "❌ " + err.message });
    } finally {
      setLoading(false);
    }
  };

  // 4.5. Refine documentation
  const refineDoc = async () => {
    if (!previewText) { alert("No documentation to refine"); return; }
    setRefineLoading(true);
    setStatus({ type: "loading", message: "⏳ Refining documentation…" });
    try {
      const res = await fetch(`${API}/refine-doc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: previewText, refinement: refinementPrompt, code, style, title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreview(data.result);
      setPreviewText(data.result);
      setRefinementPrompt("");
      setStatus({ type: "success", message: "✨ Documentation refined!" });
    } catch (err) {
      setStatus({ type: "error", message: "❌ " + err.message });
    } finally {
      setRefineLoading(false);
    }
  };

  // 5. Download .docx
  const downloadDocx = async () => {
    if (!preview) { alert("Generate documentation first"); return; }
    try {
      const res = await fetch(`${API}/download-docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: preview, title }),
      });
      if (!res.ok) throw new Error("Server error");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${(title || "documentation").replace(/\s+/g, "_")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Download failed: " + err.message);
    }
  };

  // 6. Download .pdf
  const downloadPdf = async () => {
    if (!preview) { alert("Generate documentation first"); return; }
    try {
      const res = await fetch(`${API}/download-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: preview, title }),
      });
      if (!res.ok) throw new Error("Server error");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${(title || "documentation").replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("PDF download failed: " + err.message);
    }
  };

  // 7. Detect overlaps
  const detectOverlaps = async () => {
    if (transcriptList.length < 2) {
      alert("Upload at least 2 videos to detect overlapping topics");
      return;
    }
    setOverlapLoading(true);
    try {
      const res  = await fetch(`${API}/detect-overlaps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcripts: transcriptList }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.overlaps.length === 0) {
        alert("No overlapping topics found between the uploaded videos.");
      } else {
        setOverlaps(data.overlaps);
        setShowOverlapModal(true);
      }
    } catch (err) {
      alert("Overlap detection failed: " + err.message);
    } finally {
      setOverlapLoading(false);
    }
  };

  const handleOverlapSelect = (excerpt) => {
    if (excerpt) {
      setCode(prev =>
        prev
          ? `${prev}\n\n<!-- Selected from overlap -->\n<section>\n  <p>${excerpt}</p>\n</section>`
          : `<section>\n  <p>${excerpt}</p>\n</section>`
      );
    }
    setShowOverlapModal(false);
  };

  /* ── render ── */
  return (
    <div className="app">
      <header className="app-header">
        <h1>🚀 CodeDoc <span className="header-plus">+</span> Video AI</h1>
        <p className="app-subtitle">Transcribe videos → generate HTML → produce documentation</p>
      </header>

      {/* STEP 01 · VIDEO → TRANSCRIPT */}
      <section className="card">
        <div className="card-title">
          <span className="step-badge">01</span>
          Video → Transcript
        </div>

        <div className="field-row">
          <input
            className="text-input"
            placeholder="Document / video title (optional)"
            value={videoTitle}
            onChange={(e) => setVideoTitle(e.target.value)}
          />
        </div>

        <div className="field-row upload-row">
          <label className="file-label">
            📁 {videoFile ? videoFile.name : "Choose video file"}
            <input
              type="file"
              accept="video/*"
              style={{ display: "none" }}
              onChange={(e) => setVideoFile(e.target.files[0])}
            />
          </label>
          <button className="btn btn-primary" onClick={uploadVideo} disabled={videoLoading}>
            {videoLoading ? <span className="spinner" /> : "🎬 Transcribe"}
          </button>
        </div>

        {transcript && (
          <div className="transcript-area">
            <div className="area-label">
              📝 Transcript
              <span className="badge-count">
                {transcriptList.length} video{transcriptList.length !== 1 ? "s" : ""} loaded
              </span>
            </div>
            <textarea
              className="mono-textarea"
              value={transcript}
              rows={7}
              onChange={(e) => setTranscript(e.target.value)}
            />
            <div className="transcript-actions">
              <button className="btn btn-secondary" onClick={generateHtml} disabled={htmlLoading}>
                {htmlLoading
                  ? <><span className="spinner" /> Generating HTML…</>
                  : "⚙️ Generate HTML from Transcript"}
              </button>
              {transcriptList.length >= 2 && (
                <button className="btn btn-warn" onClick={detectOverlaps} disabled={overlapLoading}>
                  {overlapLoading
                    ? <><span className="spinner" /> Detecting…</>
                    : `🔍 Detect Overlaps (${transcriptList.length} videos)`}
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* STEP 02 · HTML PREVIEW + EDIT */}
      {generatedHtml && (
        <section className="card">
          <div className="card-title">
            <span className="step-badge">02</span>
            HTML Preview &amp; Edit
          </div>

          <div className="preview-toolbar">
            <div className="tab-group">
              <button
                className={`tab ${htmlMode === "preview" ? "tab-active" : ""}`}
                onClick={() => setHtmlMode("preview")}
              >👁 Preview</button>
              <button
                className={`tab ${htmlMode === "edit" ? "tab-active" : ""}`}
                onClick={() => setHtmlMode("edit")}
              >✏️ Edit HTML</button>
            </div>
            <button className="btn btn-accent" onClick={sendToCodeDoc}>
              ➡ Send to Doc Generator
            </button>
          </div>

          {htmlMode === "preview" ? (
            <div
              className="html-render-frame"
              dangerouslySetInnerHTML={{ __html: generatedHtml }}
            />
          ) : (
            <textarea
              className="mono-textarea code-textarea"
              value={generatedHtml}
              rows={18}
              onChange={(e) => setGeneratedHtml(e.target.value)}
            />
          )}
        </section>
      )}

      {/* STEP 03 · DOC GENERATOR */}
      <section className="card" ref={codeDocRef}>
        <div className="card-title">
          <span className="step-badge">03</span>
          Documentation Generator
        </div>

        <CodeInput code={code} setCode={setCode} />
        <Options title={title} setTitle={setTitle} style={style} setStyle={setStyle} />
        <PromptBox prompt={prompt} setPrompt={setPrompt} />
        <GenerateButton loading={loading} generateDoc={generateDoc} />
        <Status status={status} />
        <Preview
          preview={preview}
          previewText={previewText}
          setPreviewText={setPreviewText}
          refinementPrompt={refinementPrompt}
          setRefinementPrompt={setRefinementPrompt}
          onRefine={refineDoc}
          refineLoading={refineLoading}
        />

        {preview && (
          <div className="download-row">
            <button className="btn btn-docx" onClick={downloadDocx}>
              📄 Download Word (.docx)
            </button>
            <button className="btn btn-pdf" onClick={downloadPdf}>
              📕 Download PDF (.pdf)
            </button>
          </div>
        )}
      </section>

      {/* OVERLAP MODAL */}
      {showOverlapModal && (
        <OverlapModal
          overlaps={overlaps}
          transcripts={transcriptList}
          onSelect={handleOverlapSelect}
          onClose={() => setShowOverlapModal(false)}
        />
      )}
    </div>
  );
}