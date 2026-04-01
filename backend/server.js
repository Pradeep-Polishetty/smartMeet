require("dotenv").config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");
const mongoose = require("mongoose");
const { PassThrough } = require("stream");
const { marked } = require("marked");
const PDFDocument = require("pdfkit");
const { Document: DBDocument, Project } = require("./models");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, LevelFormat, BorderStyle, WidthType,
  Table, TableRow, TableCell, ShadingType,
} = require("docx");

const app = express();

// ── MongoDB Connection ───────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/codedoc";
mongoose.connect(MONGODB_URI).then(() => {
  console.log("✅ MongoDB connected");
}).catch(err => {
  console.warn("⚠️ MongoDB connection failed:", err.message);
});

// ── Increase payload limits ──────────────────────────────
const corsOptions = {
  origin: process.env.FRONTEND_URL || [
    "https://smartmeet-2.onrender.com",
    "http://localhost:3000",
    "http://localhost:5173",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
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
const GROQ_API_KEY   = process.env.GROQ_API_KEY;

// ──────────────────────────────────────────────────────────
// Helper: call Groq API
// ──────────────────────────────────────────────────────────
async function callGemini(prompt) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not configured in .env");
  }
  
  try {
    const res = await axios.post(
      `https://api.groq.com/openai/v1/chat/completions`,
      {
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 4096,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`,
        },
      }
    );
    
    if (!res.data.choices || !res.data.choices[0]) {
      throw new Error("Invalid API response: No choices returned");
    }
    
    return res.data.choices[0].message.content.trim();
  } catch (error) {
    console.error("Groq API Error:", error.response?.data || error.message);
    throw error;
  }
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
    res.status(500).json({ error: "HTML generation failed: " + (err.response?.data?.error?.message || err.message) });
  }
});

// ──────────────────────────────────────────────────────────
// 3. GENERATE DOCUMENTATION (markdown)
// ──────────────────────────────────────────────────────────
app.post("/generate-doc", async (req, res) => {
  const { code, style, title, prompt } = req.body;
  if (!code) return res.status(400).json({ error: "No code provided" });

  try {
    const userPrompt = prompt || "Create clear, professional documentation";
    const styleGuide = {
      technical: "formal, precise, technical jargon acceptable with definitions",
      narrative: "conversational, engaging, story-like flow with examples",
      concise: "brief, direct, to-the-point with minimal elaboration",
      academic: "scholarly, well-researched, with proper citations and depth",
    };
    
    const result = await callGemini(
      `Generate high-quality ${style || "technical"} documentation in clean markdown format.

Title: ${title || "HTML Documentation"}
Style: ${styleGuide[style] || "professional"}
User Instructions: ${userPrompt}

HTML/Code to Document:
\`\`\`html
${code}
\`\`\`

CREATE COMPREHENSIVE DOCUMENTATION WITH:
1. **Overview Section** (2-3 sentences explaining the purpose and key features)
2. **Key Concepts** (if applicable) - major components or ideas
3. **Structure/Architecture** - how the code is organized
4. **Main Features** - what functionality it provides
5. **Usage Instructions** - how to use or implement
6. **Best Practices** - important considerations and tips
7. **Examples** - practical code examples or use cases

FORMATTING REQUIREMENTS:
- Use ## for main section headings
- Use - for bullet points with clear indentation
- Bold important terms with **word**
- Include code examples in \`\`\`html\`\`\` blocks
- Make content scannable and well-structured
- Ensure logical flow and progressive complexity

OUTPUT:
Return ONLY the markdown documentation (no markdown fences, no preamble).
Make it professional, thorough, and ${styleGuide[style] || "accessible"}.
Add real value that would help someone understand and use this code.`
    );

    res.json({ result });
  } catch (err) {
    console.error("Doc Gen Error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || "Documentation generation failed" });
  }
});

// ──────────────────────────────────────────────────────────
// 3.5. REFINE DOCUMENTATION
// ──────────────────────────────────────────────────────────
app.post("/refine-doc", async (req, res) => {
  const { markdown, refinement, code, style, title } = req.body;
  if (!markdown) return res.status(400).json({ error: "No documentation provided" });

  try {
    const userFeedback = refinement || "Improve overall quality, clarity, and completeness";
    const result = await callGemini(
      `You are an expert technical writer specializing in ${style} documentation.

CURRENT DOCUMENTATION:
\`\`\`markdown
${markdown}
\`\`\`

USER REFINEMENT REQUEST:
${userFeedback}

CONTEXT (HTML Code being documented):
\`\`\`html
${code || ""}
\`\`\`

REFINEMENT GUIDELINES:
Apply these principles to enhance the documentation:
1. **Clarity**: Use simple, direct language. Avoid jargon or explain it.
2. **Structure**: Organize logically with clear headings. Use progressive disclosure.
3. **Completeness**: Add missing details, edge cases, and examples where helpful.
4. **Accessibility**: Include context for beginners. Add explanatory phrases.
5. **Formatting**: Use code blocks for technical content, bold for key terms.
6. **Tone**: Maintain a ${style === "technical" ? "formal and precise" : style === "narrative" ? "conversational and engaging" : style === "concise" ? "brief and direct" : "professional and balanced"} tone.
7. **Examples**: Add practical examples where they clarify concepts.
8. **Engagement**: Make the content valuable and easy to scan.

OUTPUT REQUIREMENTS:
- Return ONLY the refined markdown (no additional text)
- Preserve the original structure but enhance content
- Add sections or expand existing ones as needed
- Keep markdown formatting clean and consistent
- Ensure all headings use ## (H2) for main sections
- Use - for bullet points and proper indentation
- Bold important terms with **word**
- Include code examples in \`\`\`language blocks\`\`\`

Refine the documentation now, incorporating the user's feedback while maintaining professional quality.`
    );

    res.json({ result });
  } catch (err) {
    console.error("Refinement Error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || "Refinement failed" });
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
// DOWNLOAD AS PDF
// ──────────────────────────────────────────────────────────
app.post("/download-pdf", async (req, res) => {
  const { markdown, title } = req.body;
  if (!markdown) return res.status(400).json({ error: "No content provided" });

  try {
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      bufferPages: true,
    });

    // Title
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#2c3e50').text(title || "Documentation");
    doc.moveDown(0.3);
    doc.strokeColor('#3498db').lineWidth(2).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.8);

    // Process markdown line by line
    const lines = markdown.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim();
      
      if (!trimmed) {
        // Empty line - add spacing
        doc.moveDown(0.3);
      } else if (trimmed.startsWith('# ')) {
        // H1
        doc.fontSize(20).font('Helvetica-Bold').fillColor('#2c3e50');
        doc.text(trimmed.slice(2));
        doc.moveDown(0.3);
      } else if (trimmed.startsWith('## ')) {
        // H2
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#2c3e50');
        doc.text(trimmed.slice(3));
        doc.moveDown(0.2);
      } else if (trimmed.startsWith('### ')) {
        // H3
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#34495e');
        doc.text(trimmed.slice(4));
        doc.moveDown(0.2);
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        // Bullet point
        doc.fontSize(11).font('Helvetica').fillColor('#333333');
        const bulletText = trimmed.slice(2);
        doc.text(`• ${bulletText}`, {
          indent: 20,
          width: 450,
        });
        doc.moveDown(0.15);
      } else if (trimmed.startsWith('```')) {
        // Code block fence - skip (simplified)
        return;
      } else if (trimmed.startsWith('> ')) {
        // Blockquote
        doc.fontSize(10).font('Helvetica-Oblique').fillColor('#7f8c8d');
        doc.text(trimmed.slice(2), {
          indent: 20,
          width: 430,
        });
        doc.moveDown(0.2);
      } else {
        // Regular paragraph text
        doc.fontSize(11).font('Helvetica').fillColor('#333333');
        
        // Handle bold (**text**)
        let processedText = trimmed;
        const boldRegex = /\*\*([^\*]+)\*\*/g;
        
        // Simple check for bold text
        if (boldRegex.test(trimmed)) {
          doc.fontSize(11).fillColor('#2c3e50').text(trimmed.replace(/\*\*/g, ''), {
            width: 450,
          });
        } else {
          doc.text(trimmed, {
            width: 450,
          });
        }
        doc.moveDown(0.2);
      }
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    const safeName = (title || "documentation").replace(/\s+/g, "_");
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);
    doc.end();
  } catch (err) {
    console.error("PDF Error:", err.message);
    res.status(500).json({ error: "PDF generation failed: " + err.message });
  }
});

// ──────────────────────────────────────────────────────────
// ── UTILITY: Generate PDF from Markdown ──────────────────
function generatePdfFromMarkdown(markdown, title) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        const base64Pdf = pdfBuffer.toString('base64');
        resolve(base64Pdf);
      });
      doc.on('error', reject);

      // Add title
      doc.fontSize(20).font('Helvetica-Bold').text(title || 'Document', { underline: true });
      doc.moveDown(0.5);

      // Parse and format markdown
      const lines = markdown.split('\n');
      lines.forEach((line) => {
        if (line.startsWith('# ')) {
          doc.fontSize(16).font('Helvetica-Bold').text(line.substring(2));
          doc.moveDown(0.3);
        } else if (line.startsWith('## ')) {
          doc.fontSize(14).font('Helvetica-Bold').text(line.substring(3));
          doc.moveDown(0.2);
        } else if (line.startsWith('### ')) {
          doc.fontSize(12).font('Helvetica-Bold').text(line.substring(4));
          doc.moveDown(0.2);
        } else if (line.startsWith('- ')) {
          doc.fontSize(11).font('Helvetica').text('• ' + line.substring(2), { indent: 20 });
          doc.moveDown(0.1);
        } else if (line.startsWith('* ')) {
          doc.fontSize(11).font('Helvetica').text('• ' + line.substring(2), { indent: 20 });
          doc.moveDown(0.1);
        } else if (line.trim().length > 0) {
          doc.fontSize(11).font('Helvetica').text(line);
          doc.moveDown(0.1);
        } else {
          doc.moveDown(0.2);
        }
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ──────────────────────────────────────────────────────────
// DATABASE ENDPOINTS - SAVE/RETRIEVE DOCUMENTS
// ──────────────────────────────────────────────────────────

// Save document to database
app.post("/save-document", async (req, res) => {
  const { projectName, documentTitle, content, htmlContent, style, videoTranscript, tags, description } = req.body;
  
  console.log("📥 Save Document Request:", { projectName, documentTitle, contentLength: content?.length });
  
  if (!projectName || !documentTitle || !content) {
    console.warn("❌ Missing required fields:", { projectName: !!projectName, documentTitle: !!documentTitle, content: !!content });
    return res.status(400).json({ error: "Missing required fields: projectName, documentTitle, content" });
  }

  try {
    // Generate PDF from markdown content
    console.log("🖨️ Generating PDF...");
    const pdfBase64 = await generatePdfFromMarkdown(content, documentTitle);
    console.log("✅ PDF generated, size:", Math.round(pdfBase64.length / 1024), "KB");

    // Create new document
    const newDocument = new DBDocument({
      projectName,
      sessionId: new Date().toISOString(),
      documentTitle,
      documentType: 'markdown',
      content,
      htmlContent: htmlContent || "",
      pdfData: pdfBase64,
      style: style || 'technical',
      videoTranscript: videoTranscript || "",
      tags: tags || [],
      description: description || "",
      status: 'completed',
    });

    console.log("💾 Saving document to MongoDB...", newDocument._id);
    await newDocument.save();
    console.log("✅ Document saved:", newDocument._id);

    // Update or create project
    const project = await Project.findOne({ projectName });
    if (project) {
      project.documentCount += 1;
      await project.save();
      console.log("📊 Updated project count for:", projectName);
    } else {
      await Project.create({
        projectName,
        description: `Auto-created for ${projectName}`,
        documentCount: 1,
        sessions: [{ sessionId: newDocument.sessionId, createdAt: new Date(), documentCount: 1 }],
      });
      console.log("📁 Created new project:", projectName);
    }

    res.json({ 
      success: true, 
      message: "Document saved successfully",
      documentId: newDocument._id,
    });
  } catch (err) {
    console.error("Save Document Error:", err);
    console.error("Stack:", err.stack);
    res.status(500).json({ error: "Failed to save document: " + err.message });
  }
});

// Get all projects
app.get("/projects", async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.json({ projects });
  } catch (err) {
    console.error("Get Projects Error:", err.message);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// Get documents by project name
app.get("/documents/:projectName", async (req, res) => {
  const { projectName } = req.params;

  try {
    const documents = await DBDocument.find({ projectName }).sort({ createdAt: -1 });
    const project = await Project.findOne({ projectName });
    console.log(`📄 Fetched ${documents.length} documents for project: ${projectName}`);
    res.json({ 
      projectName,
      documentCount: documents.length,
      documents,
      project,
    });
  } catch (err) {
    console.error("Get Documents Error:", err.message);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// Get single document by ID
app.get("/document/:documentId", async (req, res) => {
  const { documentId } = req.params;

  try {
    const document = await DBDocument.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json({ document });
  } catch (err) {
    console.error("Get Document Error:", err.message);
    res.status(500).json({ error: "Failed to fetch document" });
  }
});

// Update document
app.put("/document/:documentId", async (req, res) => {
  const { documentId } = req.params;
  const { documentTitle, content, htmlContent, style, tags, description, status } = req.body;

  try {
    const document = await DBDocument.findByIdAndUpdate(
      documentId,
      { 
        ...(documentTitle && { documentTitle }),
        ...(content && { content }),
        ...(htmlContent && { htmlContent }),
        ...(style && { style }),
        ...(tags && { tags }),
        ...(description && { description }),
        ...(status && { status }),
      },
      { new: true }
    );

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json({ success: true, document });
  } catch (err) {
    console.error("Update Document Error:", err.message);
    res.status(500).json({ error: "Failed to update document" });
  }
});

// Delete document
app.delete("/document/:documentId", async (req, res) => {
  const { documentId } = req.params;

  try {
    const document = await DBDocument.findByIdAndDelete(documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Update project count
    const project = await Project.findOne({ projectName: document.projectName });
    if (project) {
      project.documentCount = Math.max(0, project.documentCount - 1);
      await project.save();
    }

    res.json({ success: true, message: "Document deleted" });
  } catch (err) {
    console.error("Delete Document Error:", err.message);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// Get sessions for a project
app.get("/project-sessions/:projectName", async (req, res) => {
  const { projectName } = req.params;

  try {
    const documents = await DBDocument.find({ projectName }).select('sessionId createdAt documentTitle');
    const sessions = {};

    documents.forEach(doc => {
      if (!sessions[doc.sessionId]) {
        sessions[doc.sessionId] = {
          sessionId: doc.sessionId,
          createdAt: doc.createdAt,
          documents: [],
        };
      }
      sessions[doc.sessionId].documents.push({
        documentId: doc._id,
        documentTitle: doc.documentTitle,
      });
    });

    res.json({ projectName, sessions: Object.values(sessions) });
  } catch (err) {
    console.error("Get Sessions Error:", err.message);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

// ──────────────────────────────────────────────────────────
// DOWNLOAD ENDPOINTS - RETRIEVE FILES FROM DATABASE
// ──────────────────────────────────────────────────────────

// Download PDF from database
app.get("/download-pdf-from-db/:documentId", async (req, res) => {
  const { documentId } = req.params;

  try {
    const document = await DBDocument.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (!document.pdfData) {
      return res.status(404).json({ error: "PDF not found for this document" });
    }

    // Convert base64 to buffer and send as PDF
    const pdfBuffer = Buffer.from(document.pdfData, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${document.documentTitle.replace(/\s+/g, '_')}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Download PDF Error:", err.message);
    res.status(500).json({ error: "Failed to download PDF" });
  }
});

// Download Markdown from database
app.get("/download-markdown-from-db/:documentId", async (req, res) => {
  const { documentId } = req.params;

  try {
    const document = await DBDocument.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${document.documentTitle.replace(/\s+/g, '_')}.md"`);
    res.send(document.content);
  } catch (err) {
    console.error("Download Markdown Error:", err.message);
    res.status(500).json({ error: "Failed to download markdown" });
  }
});

// ──────────────────────────────────────────────────────────
app.listen(5000, () => console.log("🚀 Server running on http://localhost:5000"));