export const ORGANIZATION_DOCUMENTS = [
  {
    id: 'barangay-certification',
    title: 'Barangay Certification',
    kind: 'Certification',
    summary: 'Barangay Polo certifies that KISLAP Youth Volunteers is an organized youth group in Mauban, Quezon.',
    issuedBy: 'Barangay Polo, Mauban, Quezon',
    issuedOn: '2026-10-23',
    image: '/documents/barangay-certification.jpg',
  },
  {
    id: 'barangay-endorsement',
    title: 'Barangay Endorsement',
    kind: 'Endorsement',
    summary: 'Certificate of residency and endorsement issued for KISLAP Youth Volunteers and related legal purposes.',
    issuedBy: 'Barangay Polo, Mauban, Quezon',
    issuedOn: '2026-10-23',
    image: '/documents/barangay-endorsement.jpg',
  },
]

export function formatDocumentDate(iso) {
  if (!iso) return ''
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day).toLocaleDateString('en-PH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
