import { supabase } from '../supabaseClient'

const BUCKET = 'org-documents'
const MAX_BYTES = 20 * 1024 * 1024

export const DOCUMENT_KINDS = [
  'Certification',
  'Endorsement',
  'Advisory',
  'Governing rules',
  'Notice',
  'Policy',
  'Document',
]

/** Built-in files under public/documents — used until the SQL seed is run. */
export const FALLBACK_DOCUMENTS = [
  {
    id: 'barangay-certification',
    title: 'Barangay Certification',
    kind: 'Certification',
    type: 'image',
    summary: 'Barangay Polo certifies that KISLAP Youth Volunteers is an organized youth group in Mauban, Quezon.',
    issuedOn: '2026-10-23',
    src: '/documents/barangay-certification.jpg',
    filePath: null,
    sortOrder: 10,
  },
  {
    id: 'barangay-endorsement',
    title: 'Barangay Endorsement',
    kind: 'Endorsement',
    type: 'image',
    summary: 'Certificate of residency and endorsement issued for KISLAP Youth Volunteers and related legal purposes.',
    issuedOn: '2026-10-23',
    src: '/documents/barangay-endorsement.jpg',
    filePath: null,
    sortOrder: 20,
  },
  {
    id: 'advisory-notice-26-001',
    title: 'Advisory Notice 26-001',
    kind: 'Advisory',
    type: 'pdf',
    summary: 'Official KISLAP advisory notice for members, officers, and partners.',
    issuedOn: '',
    src: '/documents/advisory-notice-26-001.pdf',
    filePath: null,
    sortOrder: 30,
  },
  {
    id: 'constitution-by-laws',
    title: 'Constitution & By-Laws',
    kind: 'Governing rules',
    type: 'pdf',
    summary: 'The final Constitution and By-Laws that guide KISLAP Youth Volunteers.',
    issuedOn: '',
    src: '/documents/constitution-by-laws.pdf',
    filePath: null,
    sortOrder: 40,
  },
]

export function formatDocumentDate(iso) {
  if (!iso) return 'On file'
  const [year, month, day] = String(iso).split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day).toLocaleDateString('en-PH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function isPdfDocument(doc) {
  return doc?.type === 'pdf' || String(doc?.src || '').toLowerCase().endsWith('.pdf')
}

export function detectDocumentType(file) {
  const name = String(file?.name || '').toLowerCase()
  const mime = String(file?.type || '').toLowerCase()
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (mime.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(name)) return 'image'
  return null
}

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

function mapRow(row) {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    type: row.file_type,
    summary: row.summary || '',
    issuedOn: row.issued_on || '',
    src: row.file_url,
    filePath: row.file_path || null,
    sortOrder: row.sort_order ?? 0,
  }
}

export async function fetchOrganizationDocuments() {
  const { data, error } = await supabase
    .from('organization_documents')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    if (error.code === 'PGRST205' || /organization_documents/i.test(error.message || '')) {
      return { documents: FALLBACK_DOCUMENTS, fromDatabase: false, setupNeeded: true }
    }
    throw error
  }

  return { documents: (data || []).map(mapRow), fromDatabase: true, setupNeeded: false }
}

async function uploadDocumentFile(file) {
  const type = detectDocumentType(file)
  if (!type) throw new Error('Upload a PDF or image file (JPG, PNG, WEBP, or GIF).')
  if (file.size > MAX_BYTES) throw new Error('File is too large. Keep uploads under 20 MB.')

  const safeName = String(file.name || 'document')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const ext = safeName.includes('.') ? safeName.slice(safeName.lastIndexOf('.')) : type === 'pdf' ? '.pdf' : '.jpg'
  const path = `${type}/${crypto.randomUUID()}${ext}`

  unwrap(
    await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || (type === 'pdf' ? 'application/pdf' : 'image/jpeg'),
      upsert: false,
    }),
  )

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { file_url: data.publicUrl, file_path: path, file_type: type }
}

async function removeStoredFile(path) {
  if (!path) return
  await supabase.storage.from(BUCKET).remove([path])
}

export async function createOrganizationDocument({ title, kind, summary, issuedOn, file }) {
  if (!file) throw new Error('Choose a PDF or image file to upload.')
  const uploaded = await uploadDocumentFile(file)
  try {
    const row = unwrap(
      await supabase
        .from('organization_documents')
        .insert({
          title: title.trim(),
          kind: kind.trim() || 'Document',
          summary: summary.trim(),
          issued_on: issuedOn || null,
          file_url: uploaded.file_url,
          file_path: uploaded.file_path,
          file_type: uploaded.file_type,
          sort_order: Date.now() % 1000000000,
        })
        .select()
        .single(),
    )
    return mapRow(row)
  } catch (error) {
    await removeStoredFile(uploaded.file_path)
    throw error
  }
}

export async function updateOrganizationDocument(doc, { title, kind, summary, issuedOn, file }) {
  const patch = {
    title: title.trim(),
    kind: kind.trim() || 'Document',
    summary: summary.trim(),
    issued_on: issuedOn || null,
    updated_at: new Date().toISOString(),
  }

  let uploaded = null
  if (file) {
    uploaded = await uploadDocumentFile(file)
    patch.file_url = uploaded.file_url
    patch.file_path = uploaded.file_path
    patch.file_type = uploaded.file_type
  }

  try {
    const row = unwrap(
      await supabase.from('organization_documents').update(patch).eq('id', doc.id).select().single(),
    )
    if (uploaded && doc.filePath) {
      await removeStoredFile(doc.filePath)
    }
    return mapRow(row)
  } catch (error) {
    if (uploaded) await removeStoredFile(uploaded.file_path)
    throw error
  }
}

export async function deleteOrganizationDocument(doc) {
  unwrap(await supabase.from('organization_documents').delete().eq('id', doc.id))
  if (doc.filePath) await removeStoredFile(doc.filePath)
}
