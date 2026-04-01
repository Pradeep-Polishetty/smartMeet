import { useState, useRef } from "react";
import { marked } from "marked";
import LandingPage from "./LandingPage";
import SavedDocuments from "./SavedDocuments";
import "./App.css";

const API = "https://smartmeet-2.onrender.com";

/* ─── Step Progress Bar ───────────────────────────────────────────────── */

function StepProgress({ current, done, onGoTo }) {
  const steps = [
    { id: 1, label: "Video", sublabel: "upload" },
    { id: 2, label: "HTML", sublabel: "preview" },
    { id: 3, label: "Generate", sublabel: "docs" },
    { id: 4, label: "Export", sublabel: "download" },
  ];

  return (
    <div className="wizard-progress">
      {steps.map((s, i) => (
        <div key={s.id} className="wizard-progress-item">
          <div className="wizard-step-dot" onClick={() => onGoTo(s.id)}>
            <div
              className={`wizard-dot-circle ${
                done.has(s.id) ? "done" : current === s.id ? "active" : ""
              }`}
            >
              {done.has(s.id) ? "✓" : s.id}
            </div>
            <div className={`wizard-dot-label ${current === s.id ? "active" : ""}`}>
              {s.label}
              <span className="wizard-dot-sublabel">{s.sublabel}</span>
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className={`wizard-connector ${done.has(s.id) ? "done" : ""}`} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Nav Row ─────────────────────────────────────────────────────────── */

function NavRow({ onBack, onNext, nextLabel = "Continue", showBack = true, nextDisabled = false, extraLeft }) {
  return (
    <div className="wizard-nav-row">
      <div className="wizard-nav-left">
        {showBack && (
          <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        )}
        {extraLeft}
      </div>
      {onNext && (
        <button className="btn btn-primary" onClick={onNext} disabled={nextDisabled}>
          {nextLabel} →
        </button>
      )}
    </div>
  );
}

/* ─── Sub-components (unchanged internals) ────────────────────────────── */

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

function Status({ status }) {
  if (!status.message) return null;
  return (
    <div className={`status status-${status.type}`}>
      {status.message}
    </div>
  );
}

function Preview({
  preview, previewText, setPreviewText,
  refinementPrompt, setRefinementPrompt,
  onRefine, refineLoading,
  isSpeaking, speechPaused,
  onSpeak, onPause, onResume, onStop,
  speechSpeed, onSpeedChange,
}) {
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

      <div className="speech-controls">
        <div className="speech-buttons">
          <button
            className={`btn btn-speech ${isSpeaking ? "speaking" : ""}`}
            onClick={isSpeaking ? onStop : onSpeak}
            title={isSpeaking ? "Stop speaking" : "Read aloud"}
          >
            {isSpeaking ? "⏹️ Stop" : "🔊 Speak"}
          </button>
          {isSpeaking && !speechPaused && (
            <button className="btn btn-speech-secondary" onClick={onPause} title="Pause speech">
              ⏸️ Pause
            </button>
          )}
          {isSpeaking && speechPaused && (
            <button className="btn btn-speech-secondary" onClick={onResume} title="Resume speech">
              ▶️ Resume
            </button>
          )}
        </div>
        <div className="speed-control">
          <label htmlFor="speech-speed">Speed: </label>
          <input
            id="speech-speed"
            type="range" min="0.5" max="2" step="0.1"
            value={speechSpeed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            disabled={isSpeaking}
          />
          <span className="speed-value">{speechSpeed.toFixed(1)}x</span>
        </div>
      </div>

      <div className="refinement-row">
        <textarea
          className="refinement-input"
          rows={2}
          placeholder="Refine: Add examples, include best practices, make it more concise…"
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
            <div className="overlap-item" key={i} onClick={() => onSelect(overlap.excerpt)}>
              <div className="overlap-topic">{overlap.topic}</div>
              {overlap.excerpt && (
                <div className="overlap-excerpt">"{overlap.excerpt}"</div>
              )}
              {overlap.videoIds && (
                <div className="overlap-videos">
                  {overlap.videoIds.map((id) => {
                    const vid = transcripts.find((t) => t.id === id);
                    return vid ? <span className="overlap-tag" key={id}>{vid.title}</span> : null;
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

/* ─── Step Panels ─────────────────────────────────────────────────────── */

function Step1Panel({
  videoFile, setVideoFile,
  videoTitle, setVideoTitle,
  transcript, setTranscript,
  transcriptList,
  videoLoading, uploadVideo,
  generatedHtml, htmlLoading, generateHtml,
  overlapLoading, detectOverlaps,
  onNext, onSkip,
}) {
  return (
    <section className="card">
      <div className="card-title">
        <span className="step-badge">01</span>
        Video → Transcript
      </div>

      <p className="wizard-step-hint">
        Upload a video to extract its transcript. You can skip this step if you already have HTML or code ready.
      </p>

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

      <NavRow
        showBack={false}
        onNext={transcript && generatedHtml ? onNext : null}
        nextLabel="Continue to HTML Preview"
        extraLeft={
          <button className="btn btn-ghost wizard-skip-btn" onClick={onSkip}>
            Skip — I have HTML / code already →
          </button>
        }
      />
    </section>
  );
}

function Step2Panel({
  generatedHtml, setGeneratedHtml,
  htmlMode, setHtmlMode,
  videoTitle, title,
  setCode, setTitle,
  onBack, onNext,
}) {
  const sendToCodeDoc = () => {
    setCode(generatedHtml);
    setTitle(videoTitle || title);
    onNext();
  };

  return (
    <section className="card">
      <div className="card-title">
        <span className="step-badge">02</span>
        HTML Preview &amp; Edit
      </div>

      <p className="wizard-step-hint">
        Review and optionally edit the generated HTML before sending it to the documentation generator.
      </p>

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
      </div>

      {htmlMode === "preview" ? (
        <div className="html-render-frame" dangerouslySetInnerHTML={{ __html: generatedHtml }} />
      ) : (
        <textarea
          className="mono-textarea code-textarea"
          value={generatedHtml}
          rows={18}
          onChange={(e) => setGeneratedHtml(e.target.value)}
        />
      )}

      <NavRow
        onBack={onBack}
        onNext={sendToCodeDoc}
        nextLabel="Send to Doc Generator"
      />
    </section>
  );
}

function Step3Panel({
  code, setCode,
  title, setTitle,
  style, setStyle,
  prompt, setPrompt,
  preview, previewText, setPreviewText,
  refinementPrompt, setRefinementPrompt,
  loading, generateDoc,
  refineLoading, refineDoc,
  status,
  isSpeaking, speechPaused,
  onSpeak, onPause, onResume, onStop,
  speechSpeed, onSpeedChange,
  onBack, onNext,
}) {
  return (
    <section className="card">
      <div className="card-title">
        <span className="step-badge">03</span>
        Documentation Generator
      </div>

      <p className="wizard-step-hint">
        Paste or edit your HTML/code, choose a style, add optional instructions, then generate your documentation.
      </p>

      <CodeInput code={code} setCode={setCode} />
      <Options title={title} setTitle={setTitle} style={style} setStyle={setStyle} />
      <PromptBox prompt={prompt} setPrompt={setPrompt} />

      <button className="generate-btn" onClick={generateDoc} disabled={loading}>
        {loading
          ? <><span className="spinner" /> Generating Documentation…</>
          : <><span>⚡</span> Generate Documentation</>}
      </button>

      <Status status={status} />

      <Preview
        preview={preview}
        previewText={previewText}
        setPreviewText={setPreviewText}
        refinementPrompt={refinementPrompt}
        setRefinementPrompt={setRefinementPrompt}
        onRefine={refineDoc}
        refineLoading={refineLoading}
        isSpeaking={isSpeaking}
        speechPaused={speechPaused}
        onSpeak={onSpeak}
        onPause={onPause}
        onResume={onResume}
        onStop={onStop}
        speechSpeed={speechSpeed}
        onSpeedChange={onSpeedChange}
      />

      <NavRow
        onBack={onBack}
        onNext={preview ? onNext : null}
        nextLabel="Continue to Export"
      />
    </section>
  );
}

function Step4Panel({
  preview, title,
  downloadDocx, downloadPdf,
  onBack,
}) {
  return (
    <section className="card">
      <div className="card-title">
        <span className="step-badge">04</span>
        Export &amp; Download
      </div>

      <p className="wizard-step-hint">
        Your documentation is ready. Download it as a Word document or PDF.
      </p>

      {!preview && (
        <div className="status status-error">⚠ No documentation to export. Go back and generate first.</div>
      )}

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

      <NavRow
        onBack={onBack}
        onNext={null}
      />
    </section>
  );
}

/* ─── Main App ────────────────────────────────────────────────────────── */

export default function App() {
  // ── Wizard state ────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(1);
  const [doneSteps, setDoneSteps] = useState(new Set());

  // ── Landing Page ─────────────────────────────────────
  const [showLandingPage, setShowLandingPage] = useState(true);

  // ── CodeDoc ──────────────────────────────────────────
  const [code, setCode]       = useState("");
  const [title, setTitle]     = useState("");
  const [style, setStyle]     = useState("technical");
  const [prompt, setPrompt]   = useState("");
  const [preview, setPreview] = useState("");
  const [status, setStatus]   = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  // ── Video / Transcript ───────────────────────────────
  const [videoFile, setVideoFile]           = useState(null);
  const [transcript, setTranscript]         = useState("");
  const [videoTitle, setVideoTitle]         = useState("");
  const [videoLoading, setVideoLoading]     = useState(false);
  const [transcriptList, setTranscriptList] = useState([]);

  // ── HTML from transcript ─────────────────────────────
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [htmlMode, setHtmlMode]           = useState("preview");
  const [htmlLoading, setHtmlLoading]     = useState(false);

  // ── Overlap detection ────────────────────────────────
  const [overlaps, setOverlaps]               = useState([]);
  const [showOverlapModal, setShowOverlapModal] = useState(false);
  const [overlapLoading, setOverlapLoading]   = useState(false);

  // ── Documentation refinement ─────────────────────────
  const [previewText, setPreviewText]           = useState("");
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [refineLoading, setRefineLoading]       = useState(false);

  // ── Saved Documents ──────────────────────────────────
  const [showSavedDocuments, setShowSavedDocuments] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);

  // ── Text-to-Speech ───────────────────────────────────
  const [isSpeaking, setIsSpeaking]   = useState(false);
  const [speechPaused, setSpeechPaused] = useState(false);
  const [speechSpeed, setSpeechSpeed] = useState(1);
  const speechUtteranceRef = useRef(null);

  /* ── Wizard navigation helpers ── */
  const goToStep = (n) => setCurrentStep(n);

  const markDoneAndGoTo = (fromStep, toStep) => {
    setDoneSteps((prev) => new Set([...prev, fromStep]));
    setCurrentStep(toStep);
  };

  /* ── API handlers (unchanged) ── */

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
      setTranscriptList((prev) => [
        ...prev,
        { id: Date.now(), title: videoTitle || videoFile.name, text: data.transcript },
      ]);
    } catch (err) {
      alert("Transcription failed: " + err.message);
    } finally {
      setVideoLoading(false);
    }
  };

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
      await saveDocumentToDB(data.result, code);
    } catch (err) {
      setStatus({ type: "error", message: "❌ " + err.message });
    } finally {
      setLoading(false);
    }
  };

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
      await saveDocumentToDB(data.result, code);
    } catch (err) {
      setStatus({ type: "error", message: "❌ " + err.message });
    } finally {
      setRefineLoading(false);
    }
  };

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
      a.href = url;
      a.download = `${(title || "documentation").replace(/\s+/g, "_")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Download failed: " + err.message);
    }
  };

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
      a.href = url;
      a.download = `${(title || "documentation").replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("PDF download failed: " + err.message);
    }
  };

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
      setCode((prev) =>
        prev
          ? `${prev}\n\n<!-- Selected from overlap -->\n<section>\n  <p>${excerpt}</p>\n</section>`
          : `<section>\n  <p>${excerpt}</p>\n</section>`
      );
    }
    setShowOverlapModal(false);
  };

  const loadSavedDocument = async (documentId) => {
    try {
      const res = await fetch(`${API}/document/${documentId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const doc = data.document;
      setPreviewText(doc.content);
      setCode(doc.htmlContent || "");
      setTitle(doc.documentTitle);
      setStyle(doc.style);
      setShowSavedDocuments(false);
      setSelectedDocumentId(documentId);
      // Jump directly to step 3 when loading a saved doc
      setCurrentStep(3);
    } catch (err) {
      alert("Failed to load document: " + err.message);
    }
  };

  const saveDocumentToDB = async (content, htmlContent) => {
    if (!title || !content) return;
    try {
      const projectName   = title || "Untitled";
      const documentTitle = `${title || "Document"} - ${new Date().toLocaleDateString()}`;
      const payload = {
        projectName,
        documentTitle,
        content,
        htmlContent: htmlContent || "",
        style,
        description: `Auto-saved document from ${new Date().toLocaleString()}`,
        tags: [style, "auto-saved"],
      };
      const res  = await fetch(`${API}/save-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelectedDocumentId(data.documentId);
      setStatus({ type: "success", message: "💾 Document saved to database!" });
    } catch (err) {
      console.error("Save error:", err.message);
    }
  };

  /* ── Text-to-Speech ── */
  const handleSpeak = () => {
    if (!previewText.trim()) { alert("No documentation to read."); return; }
    if (isSpeaking) { handleStopSpeech(); return; }
    const utterance = new SpeechSynthesisUtterance(previewText);
    utterance.rate   = speechSpeed;
    utterance.pitch  = 1;
    utterance.volume = 1;
    utterance.onstart = () => { setIsSpeaking(true); setSpeechPaused(false); };
    utterance.onend   = () => { setIsSpeaking(false); setSpeechPaused(false); };
    utterance.onerror = (error) => { console.error(error); setIsSpeaking(false); };
    speechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };
  const handlePauseSpeech  = () => { window.speechSynthesis.pause();  setSpeechPaused(true); };
  const handleResumeSpeech = () => { window.speechSynthesis.resume(); setSpeechPaused(false); };
  const handleStopSpeech   = () => { window.speechSynthesis.cancel(); setIsSpeaking(false); setSpeechPaused(false); };

  /* ── Render ── */
  if (showLandingPage) {
    return <LandingPage onStart={() => setShowLandingPage(false)} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div style={{ flex: 1 }}>
          <h1> CodeDoc <span className="header-plus">+</span> Video AI</h1>
          <p className="app-subtitle">Transcribe videos → generate HTML → produce documentation</p>
        </div>
        <button
          className="btn btn-saved-docs"
          onClick={() => setShowSavedDocuments(true)}
          title="View saved projects and documents"
        >
          📁 Saved Projects
        </button>
      </header>

      {/* Step Progress */}
      <StepProgress
        current={currentStep}
        done={doneSteps}
        onGoTo={goToStep}
      />

      {/* Saved Documents overlay */}
      {showSavedDocuments && (
        <SavedDocuments
          onClose={() => setShowSavedDocuments(false)}
          onSelectDocument={loadSavedDocument}
          apiUrl={API}
        />
      )}

      {/* ── STEP 1 ── */}
      {currentStep === 1 && (
        <Step1Panel
          videoFile={videoFile}         setVideoFile={setVideoFile}
          videoTitle={videoTitle}       setVideoTitle={setVideoTitle}
          transcript={transcript}       setTranscript={setTranscript}
          transcriptList={transcriptList}
          videoLoading={videoLoading}   uploadVideo={uploadVideo}
          generatedHtml={generatedHtml}
          htmlLoading={htmlLoading}     generateHtml={generateHtml}
          overlapLoading={overlapLoading} detectOverlaps={detectOverlaps}
          onNext={() => markDoneAndGoTo(1, 2)}
          onSkip={() => goToStep(3)}
        />
      )}

      {/* ── STEP 2 ── */}
      {currentStep === 2 && (
        <Step2Panel
          generatedHtml={generatedHtml} setGeneratedHtml={setGeneratedHtml}
          htmlMode={htmlMode}           setHtmlMode={setHtmlMode}
          videoTitle={videoTitle}       title={title}
          setCode={setCode}             setTitle={setTitle}
          onBack={() => goToStep(1)}
          onNext={() => markDoneAndGoTo(2, 3)}
        />
      )}

      {/* ── STEP 3 ── */}
      {currentStep === 3 && (
        <Step3Panel
          code={code}                   setCode={setCode}
          title={title}                 setTitle={setTitle}
          style={style}                 setStyle={setStyle}
          prompt={prompt}               setPrompt={setPrompt}
          preview={preview}
          previewText={previewText}     setPreviewText={setPreviewText}
          refinementPrompt={refinementPrompt} setRefinementPrompt={setRefinementPrompt}
          loading={loading}             generateDoc={generateDoc}
          refineLoading={refineLoading} refineDoc={refineDoc}
          status={status}
          isSpeaking={isSpeaking}       speechPaused={speechPaused}
          onSpeak={handleSpeak}         onPause={handlePauseSpeech}
          onResume={handleResumeSpeech} onStop={handleStopSpeech}
          speechSpeed={speechSpeed}     onSpeedChange={setSpeechSpeed}
          onBack={() => goToStep(generatedHtml ? 2 : 1)}
          onNext={() => markDoneAndGoTo(3, 4)}
        />
      )}

      {/* ── STEP 4 ── */}
      {currentStep === 4 && (
        <Step4Panel
          preview={preview}
          title={title}
          downloadDocx={downloadDocx}
          downloadPdf={downloadPdf}
          onBack={() => goToStep(3)}
        />
      )}

      {/* Overlap Modal (available on any step) */}
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