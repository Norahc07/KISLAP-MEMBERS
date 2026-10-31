import { useEffect, useState } from 'react'
import { ExternalLink, FileText, LayoutGrid, Rows3, ShieldCheck, X } from 'lucide-react'
import Logo from '../components/Logo'
import { ORGANIZATION_DOCUMENTS, formatDocumentDate, isPdfDocument } from '../lib/documents'

const VIEW_KEY = 'kislap-documents-view'

function DocumentPreview({ doc, className = '' }) {
  if (isPdfDocument(doc)) {
    return (
      <span className={`document-pdf-preview ${className}`.trim()}>
        <FileText size={42} />
        <strong>PDF</strong>
        <small>{doc.title}</small>
      </span>
    )
  }
  return <img src={doc.src} alt="" loading="lazy" />
}

function DocumentSource({ doc }) {
  if (isPdfDocument(doc)) {
    return (
      <iframe
        className="document-pdf-frame"
        title={doc.title}
        src={`${doc.src}#view=FitH`}
      />
    )
  }
  return <img src={doc.src} alt={doc.title} />
}

export default function Documents() {
  const [view, setView] = useState(() => {
    try {
      return sessionStorage.getItem(VIEW_KEY) === 'feed' ? 'feed' : 'cards'
    } catch {
      return 'cards'
    }
  })
  const [active, setActive] = useState(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(VIEW_KEY, view)
    } catch {
      /* keep the chosen layout for this visit */
    }
  }, [view])

  useEffect(() => {
    if (!active) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event) {
      if (event.key === 'Escape') setActive(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [active])

  return (
    <div className="page page-wide documents-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Organization</p>
          <h1>Documents</h1>
          <p className="muted">Official papers that show KISLAP Youth Volunteers is recognized and how the organization is run.</p>
        </div>
        <div className="documents-toggle" role="group" aria-label="Document layout">
          <button
            type="button"
            className={`btn btn-sm ${view === 'cards' ? 'btn-primary' : 'btn-soft'}`}
            onClick={() => setView('cards')}
            aria-pressed={view === 'cards'}
          >
            <LayoutGrid size={16} /> Cards
          </button>
          <button
            type="button"
            className={`btn btn-sm ${view === 'feed' ? 'btn-primary' : 'btn-soft'}`}
            onClick={() => setView('feed')}
            aria-pressed={view === 'feed'}
          >
            <Rows3 size={16} /> Feed
          </button>
        </div>
      </div>

      {view === 'cards' ? (
        <div className="documents-grid">
          {ORGANIZATION_DOCUMENTS.map((doc) => (
            <article key={doc.id} className="document-card is-clickable">
              <button type="button" className="document-card-hit" onClick={() => setActive(doc)} aria-label={`Open ${doc.title}`}>
                <span className="document-card-media">
                  <DocumentPreview doc={doc} />
                </span>
                <span className="document-card-body">
                  <span className="document-kind">{doc.kind}</span>
                  <strong className="document-card-title">{doc.title}</strong>
                  <span className="document-card-summary">{doc.summary}</span>
                  <span className="document-card-meta">
                    <span>
                      <small>Issued by</small>
                      <em>{doc.issuedBy}</em>
                    </span>
                    <span>
                      <small>Date</small>
                      <em>{formatDocumentDate(doc.issuedOn)}</em>
                    </span>
                  </span>
                  <span className="document-card-hint">Click to view the document</span>
                </span>
              </button>
              <div className="document-card-actions">
                <a
                  className="btn btn-ghost btn-sm"
                  href={doc.src}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  <ExternalLink size={15} /> Open file
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="documents-feed">
          {ORGANIZATION_DOCUMENTS.map((doc) => (
            <article key={doc.id} className="document-post">
              <header className="document-post-head">
                <Logo size={42} />
                <div>
                  <strong>KISLAP Youth Volunteers</strong>
                  <small>{formatDocumentDate(doc.issuedOn)} · {doc.kind}</small>
                </div>
                <span className="document-verified">
                  <ShieldCheck size={15} /> Official
                </span>
              </header>
              <div className="document-post-copy">
                <h2>{doc.title}</h2>
                <p>{doc.summary}</p>
              </div>
              <button type="button" className="document-post-media" onClick={() => setActive(doc)} aria-label={`Open ${doc.title}`}>
                <DocumentPreview doc={doc} className="is-feed" />
              </button>
              <footer className="document-post-foot">
                <span>{doc.issuedBy}</span>
                <a href={doc.src} target="_blank" rel="noreferrer">
                  Open file
                </a>
              </footer>
            </article>
          ))}
        </div>
      )}

      {active && (
        <div className="document-lightbox" role="dialog" aria-modal="true" aria-label={active.title}>
          <button type="button" className="document-lightbox-scrim" aria-label="Close document" onClick={() => setActive(null)} />
          <div className={`document-lightbox-panel ${isPdfDocument(active) ? 'is-pdf' : ''}`}>
            <div className="document-lightbox-bar">
              <div>
                <strong>{active.title}</strong>
                <small>{active.issuedBy} · {formatDocumentDate(active.issuedOn)}</small>
              </div>
              <div className="document-lightbox-actions">
                <a className="btn btn-soft btn-sm" href={active.src} target="_blank" rel="noreferrer">
                  <ExternalLink size={15} /> Open file
                </a>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setActive(null)}>
                  <X size={16} /> Close
                </button>
              </div>
            </div>
            <div className="document-lightbox-frame">
              <DocumentSource doc={active} />
            </div>
            <div className="document-lightbox-footer">
              <button type="button" className="btn btn-soft" onClick={() => setActive(null)}>
                <X size={16} /> Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
