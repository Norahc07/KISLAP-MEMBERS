export const ORGANIZATION_DOCUMENTS = [
  {
    id: 'barangay-certification',
    title: 'Barangay Certification',
    kind: 'Certification',
    type: 'image',
    summary: 'Barangay Polo certifies that KISLAP Youth Volunteers is an organized youth group in Mauban, Quezon.',
    issuedBy: 'Barangay Polo, Mauban, Quezon',
    issuedOn: '2026-10-23',
    src: '/documents/barangay-certification.jpg',
  },
  {
    id: 'barangay-endorsement',
    title: 'Barangay Endorsement',
    kind: 'Endorsement',
    type: 'image',
    summary: 'Certificate of residency and endorsement issued for KISLAP Youth Volunteers and related legal purposes.',
    issuedBy: 'Barangay Polo, Mauban, Quezon',
    issuedOn: '2026-10-23',
    src: '/documents/barangay-endorsement.jpg',
  },
  {
    id: 'advisory-notice-26-001',
    title: 'Advisory Notice 26-001',
    kind: 'Advisory',
    type: 'pdf',
    summary: 'Official KISLAP advisory notice for members, officers, and partners.',
    issuedBy: 'KISLAP Youth Volunteers',
    issuedOn: '',
    src: '/documents/advisory-notice-26-001.pdf',
  },
  {
    id: 'constitution-by-laws',
    title: 'Constitution & By-Laws',
    kind: 'Governing rules',
    type: 'pdf',
    summary: 'The final Constitution and By-Laws that guide KISLAP Youth Volunteers.',
    issuedBy: 'KISLAP Youth Volunteers',
    issuedOn: '',
    src: '/documents/constitution-by-laws.pdf',
  },
]

export function formatDocumentDate(iso) {
  if (!iso) return 'On file'
  const [year, month, day] = iso.split('-').map(Number)
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
