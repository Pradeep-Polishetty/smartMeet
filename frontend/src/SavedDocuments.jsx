import { useState, useEffect } from "react";
import { marked } from "marked";
import "./SavedDocuments.css";

export default function SavedDocuments({
  onClose,
  onSelectDocument,
  apiUrl = "https://smartmeet-2.onrender.com",
}) {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDocuments, setProjectDocuments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [viewingDocument, setViewingDocument] = useState(null);
  const [viewMode, setViewMode] = useState("markdown"); // 'markdown' or 'pdf'

  // Fetch all projects
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/projects`);
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      console.error("Error fetching projects:", err);
      alert("Failed to fetch projects");
    }
    setLoading(false);
  };

  const handleProjectSelect = async (projectName) => {
    setSelectedProject(projectName);
    setLoading(true);
    try {
      // Fetch documents for this project
      const docsResponse = await fetch(
        `${apiUrl}/documents/${projectName}`
      );
      const docsData = await docsResponse.json();
      setProjectDocuments(docsData.documents || []);

      // Fetch sessions for this project
      const sessionsResponse = await fetch(
        `${apiUrl}/project-sessions/${projectName}`
      );
      const sessionsData = await sessionsResponse.json();
      setSessions(sessionsData.sessions || []);
      setSelectedSession(null);
    } catch (err) {
      console.error("Error fetching project details:", err);
      alert("Failed to fetch project documents");
    }
    setLoading(false);
  };

  const handleDeleteDocument = async (documentId, documentTitle) => {
    if (!window.confirm(`Delete "${documentTitle}"?`)) return;

    try {
      const response = await fetch(
        `${apiUrl}/document/${documentId}`,
        { method: "DELETE" }
      );
      if (response.ok) {
        alert("Document deleted successfully");
        if (selectedProject) {
          handleProjectSelect(selectedProject);
        }
      }
    } catch (err) {
      console.error("Error deleting document:", err);
      alert("Failed to delete document");
    }
  };

  const handleDownloadPDF = async (documentId, documentTitle) => {
    try {
      const response = await fetch(
        `${apiUrl}/download-pdf-from-db/${documentId}`
      );
      if (!response.ok) throw new Error("Failed to download PDF");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${documentTitle.replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading PDF:", err);
      alert("Failed to download PDF");
    }
  };

  const handleDownloadMarkdown = async (documentId, documentTitle) => {
    try {
      const response = await fetch(
        `${apiUrl}/download-markdown-from-db/${documentId}`
      );
      if (!response.ok) throw new Error("Failed to download markdown");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${documentTitle.replace(/\s+/g, "_")}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading markdown:", err);
      alert("Failed to download markdown");
    }
  };

  const handleViewDocument = async (documentId) => {
    try {
      const res = await fetch(`${apiUrl}/document/${documentId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setViewingDocument(data.document);
      setViewMode("markdown");
    } catch (err) {
      console.error("Error loading document:", err);
      alert("Failed to load document");
    }
  };

  const getSessionDocuments = (sessionId) => {
    return projectDocuments.filter((doc) => doc.sessionId === sessionId);
  };

  // Document Viewer Component
  if (viewingDocument) {
    const htmlContent = marked(viewingDocument.content || "");
    const pdfUrl = viewingDocument.pdfData ? `data:application/pdf;base64,${viewingDocument.pdfData}` : null;

    return (
      <div className="saved-documents-modal">
        <div className="document-viewer-container">
          <div className="viewer-header">
            <h2>{viewingDocument.documentTitle}</h2>
            <button className="close-btn" onClick={() => setViewingDocument(null)}>
              ✕
            </button>
          </div>

          <div className="viewer-tabs">
            <button
              className={`tab-btn ${viewMode === "markdown" ? "active" : ""}`}
              onClick={() => setViewMode("markdown")}
            >
              📝 Markdown
            </button>
            {pdfUrl && (
              <button
                className={`tab-btn ${viewMode === "pdf" ? "active" : ""}`}
                onClick={() => setViewMode("pdf")}
              >
                📄 PDF
              </button>
            )}
            <button
              className="tab-btn edit-btn"
              onClick={() => {
                onSelectDocument(viewingDocument._id);
                setViewingDocument(null);
              }}
            >
              ✏️ Edit in Editor
            </button>
          </div>

          <div className="viewer-content">
            {viewMode === "markdown" ? (
              <div 
                className="markdown-viewer"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            ) : (
              <iframe
                src={pdfUrl}
                className="pdf-viewer"
                type="application/pdf"
              />
            )}
          </div>

          <div className="viewer-footer">
            <button
              className="btn-back"
              onClick={() => setViewingDocument(null)}
            >
              ← Back to Documents
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="saved-documents-modal">
      <div className="saved-documents-container">
        <div className="saved-documents-header">
          <h2>📁 Saved Projects & Documents</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {!selectedProject ? (
          <div className="projects-view">
            <div className="projects-list">
              {loading ? (
                <p>Loading projects...</p>
              ) : projects.length === 0 ? (
                <p className="no-data">No projects yet. Generate a document to create one!</p>
              ) : (
                projects.map((project) => (
                  <div
                    key={project._id}
                    className="project-card"
                    onClick={() => handleProjectSelect(project.projectName)}
                  >
                    <h3>{project.projectName}</h3>
                    <p className="description">{project.description}</p>
                    <div className="project-stats">
                      <span className="doc-count">
                        📄 {project.documentCount} document{project.documentCount !== 1 ? "s" : ""}
                      </span>
                      <span className="created-date">
                        📅 {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="project-details-view">
            <button className="back-btn" onClick={() => {
              setSelectedProject(null);
              setSelectedSession(null);
              setProjectDocuments([]);
              setSessions([]);
            }}>
              ← Back to Projects
            </button>

            <h3>Project: {selectedProject}</h3>
            <p className="project-doc-count">Total Documents: {projectDocuments.length}</p>

            {loading ? (
              <p>Loading documents...</p>
            ) : sessions.length === 0 ? (
              <p className="no-data">No documents in this project</p>
            ) : (
              <div className="sessions-container">
                {sessions.map((session) => (
                  <div key={session.sessionId} className="session-card">
                    <div
                      className="session-header"
                      onClick={() =>
                        setSelectedSession(
                          selectedSession === session.sessionId
                            ? null
                            : session.sessionId
                        )
                      }
                    >
                      <h4>
                        {selectedSession === session.sessionId ? "▼" : "▶"} Session{" "}
                        {new Date(session.createdAt).toLocaleDateString()} (
                        {session.documents.length} doc{session.documents.length !== 1 ? "s" : ""})
                      </h4>
                    </div>

                    {selectedSession === session.sessionId && (
                      <div className="session-documents">
                        {session.documents.map((doc) => (
                          <div key={doc.documentId} className="document-item">
                            <div className="doc-title">
                              <h5>{doc.documentTitle}</h5>
                            </div>
                            <div className="doc-actions">
                              <button
                                className="btn-view"
                                onClick={() =>
                                  handleViewDocument(doc.documentId)
                                }
                                title="View document"
                              >
                                👁️ View
                              </button>
                              <button
                                className="btn-delete"
                                onClick={() =>
                                  handleDeleteDocument(
                                    doc.documentId,
                                    doc.documentTitle
                                  )
                                }
                                title="Delete document"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
