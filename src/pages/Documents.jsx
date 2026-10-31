import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog'
import DateField from '../components/DateField'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { errorMessage } from '../lib/constants'
import {
  DOCUMENT_KINDS,
  createOrganizationDocument,
  deleteOrganizationDocument,
  detectDocumentType,
  fetchOrganizationDocuments,
  formatDocumentDate,
  isPdfDocument,
  updateOrganizationDocument,
} from '../lib/documents'
import { getPdfPageCount, renderPdfPage } from '../lib/pdf'
import { supabase } from '../supabaseClient'

function DocumentPreview({ doc }) {
  const [preview, setPreview] = useState('')
  const [failed, setFailed] = useState(false)
  const pdf = isPdfDocument(doc)

  useEffect(() => {
    if (!pdf) return undefined
    let live = true
    setFailed(false)
    setPreview('')
    renderPdfPage(doc.src, 1, 1.1)
      .then((page) => {
        if (live) setPreview(page.dataUrl)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [doc.src, pdf])

  if (!pdf) {
    return <img className="document-thumb" src={doc.src} alt="" loading="lazy" />
  }

  if (preview) {
    return (
      <span className="document-pdf-thumb">
        <img src={preview} alt="" />
        <span className="document-pdf-badge">PDF</span>
      </span>
    )
  }

  return (
    <span className="document-pdf-preview">
      <FileText size={36} />
      <strong>{failed ? 'PDF' : 'Loading…'}</strong>
      <small>{doc.title}</small>
    </span>
  )
}

function PdfViewer({ doc }) {
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [image, setImage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let live = true
    setBusy(true)
    setError('')
    setImage('')
    getPdfPageCount(doc.src)
      .then((count) => {
        if (!live) return
        setPageCount(count)
        setPage(1)
      })
      .catch(() => {
        if (live) setError('This PDF could not be opened here. Use Open file instead.')
      })
    return () => {
      live = false
    }
  }, [doc.src])

  useEffect(() => {
    let live = true
    setBusy(true)
    setError('')
    renderPdfPage(doc.src, page, 1.55)
      .then((result) => {
        if (!live) return
        setImage(result.dataUrl)
        setPageCount(result.pageCount)
        setBusy(false)
      })
      .catch(() => {
        if (!live) return
        setBusy(false)
        setError('This PDF could not be opened here. Use Open file instead.')
      })
    return () => {
      live = false
    }
  }, [doc.src, page])

  return (
    <div className="document-pdf-viewer">
      <div className="document-pdf-toolbar">
        <button type="button" className="btn btn-soft btn-sm" disabled={page <= 1 || busy} onClick={() => setPage((current) => Math.max(1, current - 1))}>
          <ChevronLeft size={16} /> Prev
        </button>
        <strong>
          Page {page} of {pageCount}
        </strong>
        <button type="button" className="btn btn-soft btn-sm" disabled={page >= pageCount || busy} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>
          Next <ChevronRight size={16} />
        </button>
      </div>
      <div className="document-pdf-stage">
        {error ? (
          <div className="document-pdf-fallback">
            <FileText size={36} />
            <p>{error}</p>
            <a className="btn btn-primary btn-sm" href={doc.src} target="_blank" rel="noreferrer">
              <ExternalLink size={15} /> Open file
            </a>
          </div>
        ) : image ? (
          <img src={image} alt={`${doc.title} page ${page}`} />
        ) : (
          <div className="document-pdf-fallback">
            <div className="spinner" />
            <p>Preparing page…</p>
          </div>
        )}
      </div>
    </div>
  )
}

function DocumentSource({ doc }) {
  if (isPdfDocument(doc)) return <PdfViewer doc={doc} />
  return <img src={doc.src} alt={doc.title} />
}

function emptyForm() {
  return {
    title: '',
    kind: 'Document',
    summary: '',
    issuedOn: '',
    file: null,
    fileLabel: '',
  }
}

function formFromDoc(doc) {
  return {
    title: doc.title || '',
    kind: doc.kind || 'Document',
    summary: doc.summary || '',
    issuedOn: doc.issuedOn || '',
    file: null,
    fileLabel: '',
  }
}

function DocumentFormModal({ doc, onClose, onSaved }) {
  const [form, setForm] = useState(() => (doc ? formFromDoc(doc) : emptyForm()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const editing = Boolean(doc)

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function onFile(event) {
    const file = event.target.files?.[0] || null
    event.target.value = ''
    if (!file) return
    if (!detectDocumentType(file)) {
      setError('Upload a PDF or image file (JPG, PNG, WEBP, or GIF).')
      return
    }
    setError('')
    setField('file', file)
    setField('fileLabel', file.name)
  }

  async function onSubmit(event) {
    event.preventDefault()
    if (!form.title.trim()) {
      setError('Add a clear document title.')
      return
    }
    if (!editing && !form.file) {
      setError('Choose a PDF or image file to upload.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const payload = {
        title: form.title,
        kind: form.kind,
        summary: form.summary,
        issuedOn: form.issuedOn,
        file: form.file,
      }
      const saved = editing
        ? await updateOrganizationDocument(doc, payload)
        : await createOrganizationDocument(payload)
      onSaved(saved)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={editing ? 'Edit document' : 'Add document'}
      subtitle="PDF or image only. Cards show a landscape preview so members can open and read the file easily."
      onClose={onClose}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="document-form" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add document'}
          </button>
        </>
      }
    >
      <form id="document-form" className="document-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Title</span>
          <input
            className="input"
            value={form.title}
            onChange={(event) => setField('title', event.target.value)}
            placeholder="Example: Barangay Certification"
            required
          />
        </label>

        <label className="field">
          <span>Category</span>
          <select className="input" value={form.kind} onChange={(event) => setField('kind', event.target.value)}>
            {DOCUMENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Short description</span>
          <textarea
            className="input"
            rows={3}
            value={form.summary}
            onChange={(event) => setField('summary', event.target.value)}
            placeholder="One or two sentences members will read on the card."
          />
        </label>

        <DateField label="Date (optional)" value={form.issuedOn} onChange={(value) => setField('issuedOn', value)} />

        <div className="field">
          <span>{editing ? 'Replace file (optional)' : 'File (PDF or image)'}</span>
          <label className="document-file-picker">
            <Upload size={18} />
            <span>
              <strong>{form.fileLabel || (editing ? 'Keep current file' : 'Choose PDF or image')}</strong>
              <small>JPG, PNG, WEBP, GIF, or PDF · up to 20 MB</small>
            </span>
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,.pdf" onChange={onFile} />
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  )
}

export default function Documents() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [active, setActive] = useState(null)
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(null)

  async function loadDocuments() {
    setLoading(true)
    try {
      const result = await fetchOrganizationDocuments()
      setDocuments(result.documents)
      setSetupNeeded(Boolean(result.setupNeeded))
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  useEffect(() => {
    if (setupNeeded) return undefined
    const channel = supabase
      .channel('organization-documents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'organization_documents' }, () => {
        loadDocuments()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [setupNeeded])

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

  async function handleDelete() {
    try {
      await deleteOrganizationDocument(deleting)
      setDocuments((current) => current.filter((item) => item.id !== deleting.id))
      if (active?.id === deleting.id) setActive(null)
      toast.success('Document removed')
    } catch (err) {
      toast.error(errorMessage(err))
      throw err
    }
  }

  function onSaved(saved, wasEdit) {
    setDocuments((current) => {
      const exists = current.some((item) => item.id === saved.id)
      const next = exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved]
      return [...next].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.title.localeCompare(b.title))
    })
    toast.success(wasEdit ? 'Document updated' : 'Document added')
  }

  return (
    <div className="page page-wide documents-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Organization</p>
          <h1>Documents</h1>
          <p className="muted">Official papers that show KISLAP Youth Volunteers is recognized and how the organization is run.</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (setupNeeded) {
                toast.error('Run supabase/organization-documents.sql in the Supabase SQL Editor first.')
                return
              }
              setAdding(true)
            }}
          >
            <Plus size={16} /> Add document
          </button>
        )}
      </div>

      {isAdmin && setupNeeded && (
        <div className="alert">
          Run <code>supabase/organization-documents.sql</code> in the Supabase SQL Editor to enable adding, editing, and deleting documents.
        </div>
      )}

      {loading ? (
        <div className="documents-loading">
          <div className="spinner" />
          <p className="muted">Loading documents…</p>
        </div>
      ) : !documents.length ? (
        <div className="documents-loading">
          <p className="muted">{isAdmin ? 'No documents yet. Add a PDF or image to get started.' : 'No organization documents are posted yet.'}</p>
        </div>
      ) : (
        <div className="documents-grid">
          {documents.map((doc) => (
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
                {isAdmin && !setupNeeded && (
                  <>
                    <button
                      type="button"
                      className="btn btn-soft btn-sm"
                      onClick={() => setEditing(doc)}
                    >
                      <Pencil size={15} /> Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setDeleting(doc)}
                    >
                      <Trash2 size={15} /> Delete
                    </button>
                  </>
                )}
              </div>
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
                <small>{formatDocumentDate(active.issuedOn)}</small>
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
          </div>
        </div>
      )}

      {(adding || editing) && (
        <DocumentFormModal
          doc={editing}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
          onSaved={(saved) => {
            onSaved(saved, Boolean(editing))
            setAdding(false)
            setEditing(null)
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete document"
          message={`Remove “${deleting.title}” from the Documents page? Members will no longer see it.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
