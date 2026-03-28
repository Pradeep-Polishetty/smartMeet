require("dotenv").config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");
const { PassThrough } = require("stream");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, LevelFormat, BorderStyle, WidthType,
  Table, TableRow, TableCell, ShadingType,
} = require("docx");

const app = express();

// ── Increase payload limits ──────────────────────────────
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── Use disk storage so large files don't blow memory ────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, require("os").tmpdir()),
  filename:    (req, file, cb) => cb(null, `upload_${Date.now()}_${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
});

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const GEMINI_API_KEY   = process.env.GEMINI_API_KEY;

// ──────────────────────────────────────────────────────────
// Helper: call Gemini
// ──────────────────────────────────────────────────────────
async function callGemini(prompt) {
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    { contents: [{ parts: [{ text: prompt }] }] },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data.candidates[0].content.parts[0].text.trim();
}

// ──────────────────────────────────────────────────────────
// 1. VIDEO → TRANSCRIPT
// ──────────────────────────────────────────────────────────
app.post("/video-to-text", (req, res) => {
  // 15-minute timeout for large files
  req.setTimeout(15 * 60 * 1000);
  res.setTimeout(15 * 60 * 1000);

  upload.single("video")(req, res, async (err) => {
    if (err) {
      console.error("Multer error:", err.message);
      return res.status(400).json({ error: "File upload failed: " + err.message });
    }
    try {
      if (!req.file) return res.status(400).json({ error: "No video file received" });

      console.log(`📹 File received: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(1)} MB)`);

      const fs = require("fs");
      const fileStream = fs.createReadStream(req.file.path);

      const response = await axios.post(
        "https://api.deepgram.com/v1/listen?smart_format=true&model=nova-2",
        fileStream,
        {
          headers: {
            Authorization: `Token ${DEEPGRAM_API_KEY}`,
            "Content-Type": req.file.mimetype,
            "Connection": "keep-alive",
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 15 * 60 * 1000,
        }
      );

      fs.unlink(req.file.path, () => {});

      const result = response.data.results.channels[0].alternatives[0];
      console.log("✅ Transcription complete");
      res.json({ transcript: result.transcript, confidence: result.confidence });

    } catch (err) {
      if (req.file?.path) require("fs").unlink(req.file.path, () => {});
      console.error("Transcription Error:", err.response?.data || err.message);
      res.status(500).json({ error: "Transcription failed: " + (err.response?.data?.err_msg || err.message) });
    }
  });
});

// ──────────────────────────────────────────────────────────
// 2. TRANSCRIPT → HTML
// ──────────────────────────────────────────────────────────
app.post("/transcript-to-html", async (req, res) => {
  const { transcript, title } = req.body;
  if (!transcript) return res.status(400).json({ error: "No transcript provided" });

  try {
    const raw = await callGemini(
      `Convert the following video transcript into a clean, well-structured HTML page.
Title: "${title || "Video Summary"}"

Rules:
- Return ONLY the raw HTML. No markdown fences, no explanation, no extra text.
- Use semantic tags: <h1>, <h2>, <h3>, <p>, <ul>/<li>, <section>.
- Group related ideas into <section> blocks with an <h2> heading each.
- Keep the content factual and faithful to the transcript.
- Add a short <p class="summary"> after <h1> summarising the content in 1–2 sentences.

Transcript:
${transcript}`
    );

    // Strip accidental fences just in case
    const html = raw.replace(/^```html\s*/i, "").replace(/```\s*$/, "").trim();
    res.json({ html });
  } catch (err) {
    console.error("HTML Gen Error:", err.response?.data || err.message);
    res.status(500).json({ error: "HTML generation failed" });
  }
});

// ──────────────────────────────────────────────────────────
// 3. GENERATE DOCUMENTATION (markdown)
// ──────────────────────────────────────────────────────────
app.post("/generate-doc", async (req, res) => {
  const { code, style, title, prompt } = req.body;
  if (!code) return res.status(400).json({ error: "No code provided" });

  try {
    const userPrompt = prompt || "Generate comprehensive HTML documentation";
    const result = await callGemini(
      `You are a professional code documentation expert.
Generate ${style || "technical"} documentation for the following HTML code in markdown format.

Title: ${title || "HTML Documentation"}
Custom Instructions: ${userPrompt}

HTML Code:
\`\`\`html
${code}
\`\`\`

Provide structured markdown with sections: Overview, Structure, Components, Features, and Usage.
Use proper markdown: # for h1, ## for h2, - for bullets, **bold** for emphasis.`
    );

    res.json({ result });
  } catch (err) {
    console.error("Doc Gen Error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || "Documentation generation failed" });
  }
});

// ──────────────────────────────────────────────────────────
// 4. DETECT TOPIC OVERLAPS BETWEEN MULTIPLE TRANSCRIPTS
// ──────────────────────────────────────────────────────────
app.post("/detect-overlaps", async (req, res) => {
  const { transcripts } = req.body; // [{ id, title, text }]
  if (!transcripts || transcripts.length < 2)
    return res.status(400).json({ error: "Need at least 2 transcripts" });

  try {
    const promptText = `You are an expert content analyst.
Analyse these ${transcripts.length} video transcripts and find topics that overlap between them.

${transcripts.map((t, i) => `=== Video ${i + 1}: "${t.title || `Video ${i + 1}`}" ===\n${t.text.slice(0, 1200)}`).join("\n\n")}

Return ONLY valid JSON (no backticks, no explanation) matching this exact schema:
{
  "overlaps": [
    {
      "topic": "Short topic name",
      "description": "One sentence explaining the overlap",
      "sources": [0, 1],
      "excerpts": [
        "Relevant excerpt from Video 1 (2-4 sentences)",
        "Relevant excerpt from Video 2 (2-4 sentences)"
      ]
    }
  ]
}

If no overlaps are found, return { "overlaps": [] }.`;

    const raw = await callGemini(promptText);
    const clean = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(clean);
    res.json(parsed);
  } catch (err) {
    console.error("Overlap Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Overlap detection failed" });
  }
});

// ──────────────────────────────────────────────────────────
// 5. DOWNLOAD AS PROPER .DOCX
// ──────────────────────────────────────────────────────────

// Parse inline bold: "some **bold** text" → array of TextRun
function parseInline(text, baseSize = 22) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return segments.map((seg) => {
    if (seg.startsWith("**") && seg.endsWith("**")) {
      return new TextRun({ text: seg.slice(2, -2), bold: true, font: "Arial", size: baseSize });
    }
    return new TextRun({ text: seg, font: "Arial", size: baseSize });
  });
}

// Build docx Paragraph objects from markdown lines
function markdownToDocx(markdown) {
  const lines = markdown.split("\n");
  const children = [];
  let inCodeBlock = false;
  let codeBuffer = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Code block fence
    if (line.trimStart().startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBuffer = [];
      } else {
        // Flush code block as monospace paragraphs
        for (const codeLine of codeBuffer) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: codeLine || " ", font: "Courier New", size: 18, color: "CC0000" })],
              spacing: { before: 0, after: 0 },
              indent: { left: 720 },
            })
          );
        }
        inCodeBlock = false;
        codeBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    const trimmed = line.trim();

    // Empty line → spacer paragraph
    if (!trimmed) {
      children.push(new Paragraph({ children: [new TextRun("")], spacing: { before: 60, after: 60 } }));
      continue;
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: trimmed.slice(4), bold: true, font: "Arial", size: 22 })],
      }));
      continue;
    }
    if (trimmed.startsWith("## ")) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: trimmed.slice(3), bold: true, font: "Arial", size: 26 })],
      }));
      continue;
    }
    if (trimmed.startsWith("# ")) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: trimmed.slice(2), bold: true, font: "Arial", size: 32 })],
      }));
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      children.push(new Paragraph({
        children: [new TextRun("")],
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2E75B6", space: 1 } },
        spacing: { before: 200, after: 200 },
      }));
      continue;
    }

    // Unordered bullet  (- or *)
    if (/^[-*] /.test(trimmed)) {
      children.push(new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: parseInline(trimmed.slice(2)),
      }));
      continue;
    }

    // Numbered list
    if (/^\d+\. /.test(trimmed)) {
      const text = trimmed.replace(/^\d+\. /, "");
      children.push(new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        children: parseInline(text),
      }));
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed.slice(2), italics: true, font: "Arial", size: 22, color: "555555" })],
        indent: { left: 720 },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: "2E75B6", space: 12 } },
        spacing: { before: 80, after: 80 },
      }));
      continue;
    }

    // Normal paragraph with inline parsing
    children.push(new Paragraph({
      children: parseInline(trimmed),
      spacing: { before: 60, after: 60 },
    }));
  }

  return children;
}

app.post("/download-docx", async (req, res) => {
  const { markdown, title } = req.body;
  if (!markdown) return res.status(400).json({ error: "No content provided" });

  try {
    const children = markdownToDocx(markdown);

    const doc = new Document({
      numbering: {
        config: [
          {
            reference: "bullets",
            levels: [{
              level: 0,
              format: LevelFormat.BULLET,
              text: "\u2022",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            }],
          },
          {
            reference: "numbers",
            levels: [{
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            }],
          },
        ],
      },
      styles: {
        default: {
          document: { run: { font: "Arial", size: 22 } },
        },
        paragraphStyles: [
          {
            id: "Heading1", name: "Heading 1",
            basedOn: "Normal", next: "Normal", quickFormat: true,
            run:       { size: 32, bold: true, font: "Arial", color: "1F3864" },
            paragraph: { spacing: { before: 320, after: 200 }, outlineLevel: 0 },
          },
          {
            id: "Heading2", name: "Heading 2",
            basedOn: "Normal", next: "Normal", quickFormat: true,
            run:       { size: 26, bold: true, font: "Arial", color: "2E75B6" },
            paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 },
          },
          {
            id: "Heading3", name: "Heading 3",
            basedOn: "Normal", next: "Normal", quickFormat: true,
            run:       { size: 22, bold: true, font: "Arial", color: "2E75B6" },
            paragraph: { spacing: { before: 180, after: 120 }, outlineLevel: 2 },
          },
        ],
      },
      sections: [{
        properties: {
          page: {
            size:   { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const safeName = (title || "documentation").replace(/\s+/g, "_");

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.docx"`);
    res.send(buffer);
  } catch (err) {
    console.error("DOCX Error:", err.message);
    res.status(500).json({ error: "DOCX generation failed: " + err.message });
  }
});

// ──────────────────────────────────────────────────────────
app.listen(5000, () => console.log("🚀 Server running on http://localhost:5000"));