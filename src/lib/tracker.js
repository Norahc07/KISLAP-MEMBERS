export const TRACKER_ROLES = [
  { value: 'officer', label: 'Officer' },
  { value: 'director', label: 'Director' },
  { value: 'assistant', label: 'Assistant' },
  { value: 'member', label: 'Member' },
]

export const REQUIREMENT_COLUMNS = [
  { key: 'gforms', label: 'GForms', short: 'GForms', required: false },
  { key: 'registration_form', label: 'Registration Form', short: 'Registration', required: true },
  { key: 'photo_2x2', label: '2×2 / Passport Picture', short: '2×2 Photo', required: true },
  { key: 'interview', label: 'Interview', short: 'Interview', required: true },
  { key: 'membership_fee', label: 'Membership Fee', short: 'Fee', required: true },
]

export const memberCode = (memberNo) => `KISLAP-26-${String(memberNo).padStart(3, '0')}`

export function listedOnTracker(row) {
  const unnamed = !String(row.full_name || '').trim()
  if (unnamed && row.member_no >= 46 && row.member_no <= 56) return false
  return true
}

export const requirementsComplete = (row) =>
  REQUIREMENT_COLUMNS.filter((column) => column.required).every((column) => row[column.key])

export const normName = (value) => (value || '').toUpperCase().replace(/[^A-Z0-9Ñ]+/g, ' ').trim()
