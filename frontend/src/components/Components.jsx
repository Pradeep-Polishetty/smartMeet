// components/Components.jsx
import { marked } from "marked";

export function CodeInput({ code, setCode }) {
  return (
    <div className="comp-box">
      <div className="comp-label">HTML Code Input</div>
      <textarea
        className="mono-textarea code-textarea"
        value={code}
        rows={10}
        onChange={(e) => setCode(e.target.value)}
        placeholder="<div>Paste your HTML here — or send from Step 2 above</div>"
      />
    </div>
  );
}

export function Options({ title, setTitle, style, setStyle }) {
  return (
    <div className="comp-box comp-row">
      <input
        className="text-input"
        placeholder="Document title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <select
        className="select-input"
        value={style}
        onChange={(e) => setStyle(e.target.value)}
      >
        <option value="technical">Technical</option>
        <option value="readme">README</option>
        <option value="tutorial">Tutorial</option>
        <option value="api">API Reference</option>
        <option value="review">Code Review</option>
      </select>
    </div>
  );
}

export function PromptBox({ prompt, setPrompt }) {
  return (
    <div className="comp-box">
      <div className="comp-label">Custom Instructions (optional)</div>
      <textarea
        className="mono-textarea"
        placeholder="e.g. Focus on accessibility, include usage examples…"
        value={prompt}
        rows={3}
        onChange={(e) => setPrompt(e.target.value)}
      />
    </div>
  );
}

export function GenerateButton({ loading, generateDoc }) {
  return (
    <button className="btn btn-primary btn-full" onClick={generateDoc} disabled={loading}>
      {loading ? (
        <><span className="spinner" /> Generating Documentation…</>
      ) : (
        "🧠 Generate Documentation"
      )}
    </button>
  );
}

export function Status({ status }) {
  if (!status.message) return null;
  return (
    <p className={`status-msg status-${status.type}`}>
      {status.message}
    </p>
  );
}

export function Preview({ preview, previewText, setPreviewText, refinementPrompt, setRefinementPrompt, onRefine, refineLoading }) {
  if (!preview) return null;
  
  const htmlContent = marked(preview);
  
  return (
    <div className="comp-box preview-output" style={{ marginTop: "20px" }}>
      <div className="comp-label">Generated Documentation - Edit & Refine</div>
      
      <textarea
        className="mono-textarea code-textarea"
        value={previewText || preview}
        rows={12}
        onChange={(e) => setPreviewText && setPreviewText(e.target.value)}
        placeholder="Edit your documentation here..."
      />
      
      <div className="preview-refinement" style={{ marginTop: "15px" }}>
        <textarea
          className="mono-textarea"
          value={refinementPrompt}
          rows={3}
          onChange={(e) => setRefinementPrompt && setRefinementPrompt(e.target.value)}
          placeholder="Add refinement instructions for Gemini (optional)..."
        />
        <button 
          className="btn btn-primary" 
          onClick={onRefine}
          disabled={refineLoading}
          style={{ marginTop: "10px" }}
        >
          {refineLoading ? <><span className="spinner" /> Refining…</> : "✨ Refine with Gemini"}
        </button>
      </div>
      
      <div className="preview-render" style={{ marginTop: "30px", padding: "20px", border: "1px solid #2a2a3e", borderRadius: "8px", backgroundColor: "#0f0f1a" }}>
        <div className="comp-label">Live Preview</div>
        <div
          className="rendered-markdown"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>
    </div>
  );
}