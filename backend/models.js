const mongoose = require('mongoose');

// Document Schema - stores individual documents/PDFs
const documentSchema = new mongoose.Schema(
  {
    projectName: {
      type: String,
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      default: () => new Date().toISOString(),
    },
    documentTitle: {
      type: String,
      required: true,
    },
    documentType: {
      type: String,
      enum: ['markdown', 'pdf', 'docx'],
      default: 'markdown',
    },
    content: {
      type: String,
      required: true,
    },
    htmlContent: {
      type: String,
    },
    pdfData: {
      type: String,  // Base64 encoded PDF
    },
    style: {
      type: String,
      enum: ['technical', 'narrative', 'concise', 'academic'],
      default: 'technical',
    },
    videoTranscript: {
      type: String,
    },
    tags: [String],
    description: String,
    status: {
      type: String,
      enum: ['draft', 'completed', 'archived'],
      default: 'draft',
    },
  },
  { timestamps: true }
);

// Project Schema - organizes documents by project
const projectSchema = new mongoose.Schema(
  {
    projectName: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    description: String,
    documentCount: {
      type: Number,
      default: 0,
    },
    sessions: [
      {
        sessionId: String,
        createdAt: Date,
        documentCount: Number,
      },
    ],
  },
  { timestamps: true }
);

const Document = mongoose.model('Document', documentSchema);
const Project = mongoose.model('Project', projectSchema);

module.exports = { Document, Project };
