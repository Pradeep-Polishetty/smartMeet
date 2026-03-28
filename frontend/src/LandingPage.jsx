import "./LandingPage.css";

export default function LandingPage({ onStart }) {
  return (
    <div className="landing">
      {/* ── NAV ─────────────────────────────────────────── */}
      <nav className="landing-nav">
        <div className="nav-content">
          <div className="logo">
            <span className="logo-icon">🚀</span>
            <span className="logo-text">Code<span>Doc</span>+</span>
          </div>
          <button className="btn btn-nav" onClick={onStart}>
            Get Started →
          </button>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-eyebrow">AI-Powered Documentation</div>
          <h1 className="hero-title">
            <span className="line-break">Videos into</span>
            <span className="gradient-text">Professional Docs</span>
          </h1>
          <p className="hero-subtitle">
            Transcribe videos, generate semantic HTML, craft polished documentation,
            and export to Word or Markdown — all in one AI-powered pipeline.
          </p>
          <button className="btn btn-hero" onClick={onStart}>
            <span>⚡</span> Start Creating Now
          </button>
        </div>

        <div className="hero-visual">
          <div className="feature-showcase">
            <div className="showcase-card">
              <div className="card-icon">🎬</div>
              <div className="card-text">Video Transcription</div>
            </div>
            <div className="showcase-card">
              <div className="card-icon">🌐</div>
              <div className="card-text">HTML Generation</div>
            </div>
            <div className="showcase-card">
              <div className="card-icon">📚</div>
              <div className="card-text">Smart Docs</div>
            </div>
            <div className="showcase-card">
              <div className="card-icon">✨</div>
              <div className="card-text">AI Refinement</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────── */}
      <section className="features">
        <div className="features-inner">
          <div className="section-header">
            <h2>Powerful Features</h2>
            <span className="section-tag">What it does</span>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <span className="feature-icon">🎥</span>
              <h3>Video to Transcript</h3>
              <p>Upload videos up to 500MB and get instant transcriptions with industry-leading accuracy.</p>
            </div>
            <div className="feature-card">
              <span className="feature-icon">🔄</span>
              <h3>Smart HTML Generation</h3>
              <p>Automatically convert transcripts into clean, semantic HTML with proper structure.</p>
            </div>
            <div className="feature-card">
              <span className="feature-icon">📖</span>
              <h3>AI Doc Generator</h3>
              <p>Create professional docs in multiple styles: technical, narrative, concise, or academic.</p>
            </div>
            <div className="feature-card">
              <span className="feature-icon">✏️</span>
              <h3>Live Editing</h3>
              <p>Edit documentation directly and use AI to refine content with custom instructions.</p>
            </div>
            <div className="feature-card">
              <span className="feature-icon">📥</span>
              <h3>Multiple Export Formats</h3>
              <p>Download as professional Word documents or clean Markdown files, instantly.</p>
            </div>
            <div className="feature-card">
              <span className="feature-icon">🔍</span>
              <h3>Overlap Detection</h3>
              <p>Detect overlapping topics across multiple videos to identify common themes and patterns.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────── */}
      <section className="how-it-works">
        <div className="how-it-works-inner">
          <div className="section-header">
            <h2>How It Works</h2>
            <span className="section-tag">4-step pipeline</span>
          </div>

          <div className="steps-container">
            <div className="step">
              <div className="step-number">01</div>
              <div className="step-content">
                <h3>Upload Video</h3>
                <p>Choose a video file (up to 500MB) and get instant transcription via Deepgram.</p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">02</div>
              <div className="step-content">
                <h3>Generate HTML</h3>
                <p>Automatically convert the transcript into structured, semantic HTML content.</p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">03</div>
              <div className="step-content">
                <h3>Create Docs</h3>
                <p>Generate professional documentation with AI assistance and custom instructions.</p>
              </div>
            </div>

            <div className="step">
              <div className="step-number">04</div>
              <div className="step-content">
                <h3>Export &amp; Share</h3>
                <p>Download as Word (.docx), Markdown (.md), or refine further with AI.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HIGHLIGHT ───────────────────────────────────── */}
      <section className="highlight">
        <div className="highlight-content">
          <div className="highlight-text">
            <h2>Powered by Advanced AI</h2>
            <p>
              Leveraging cutting-edge AI models to understand your content and create
              professional documentation automatically. Edit in real-time, refine with AI,
              and export in multiple formats — all in one place.
            </p>
            <ul className="highlight-list">
              <li>Real-time editing with live preview</li>
              <li>AI-powered content refinement</li>
              <li>Multiple documentation styles</li>
              <li>Professional export formats</li>
              <li>Batch processing &amp; overlap detection</li>
            </ul>
          </div>

          <div className="highlight-visual">
            <div className="tech-stack">
              <div className="tech-badge">React</div>
              <div className="tech-badge">Groq AI</div>
              <div className="tech-badge">Deepgram</div>
              <div className="tech-badge">Express.js</div>
              <div className="tech-badge">Mammoth</div>
              <div className="tech-badge">Vite</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────── */}
      <section className="cta">
        <div className="cta-inner">
          <h2>Ready to Transform Your Content?</h2>
          <p>Start creating professional documentation from videos today — no setup required.</p>
          <button className="btn btn-cta" onClick={onStart}>
            <span>🚀</span> Launch App
          </button>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <footer className="landing-footer">
        <p>© 2026 CodeDoc+. Built with AI for creators and developers.</p>
        <span className="footer-dot" />
      </footer>
    </div>
  );
}