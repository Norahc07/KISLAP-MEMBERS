import { parseMemberNo } from './registration'
import { memberCode } from './tracker'

export const ADMIN_USERNAME = 'admin'
export const ADMIN_EMAIL = 'admin@admin.com'
export const TRACKER_ACCESS_ROLES = ['officer', 'director', 'assistant', 'member']

export const STAFF_PAGES = [
  { key: 'registrations', label: 'eRegForms', path: '/registrations' },
  { key: 'members', label: 'Members', path: '/members' },
  { key: 'assign', label: 'Assign Roles', path: '/assign' },
  { key: 'tracker', label: 'Tracker', path: '/tracker' },
  { key: 'users', label: 'Users', path: '/users' },
  { key: 'audit', label: 'Audit log', path: '/audit' },
]

export const STAFF_PAGE_KEYS = STAFF_PAGES.map((page) => page.key)

export function staffPageLabel(key) {
  return STAFF_PAGES.find((page) => page.key === key)?.label || key
}

export function loginEmail(username) {
  const value = String(username || '').trim()
  if (!value) return null
  if (value.toLowerCase() === ADMIN_USERNAME) return ADMIN_EMAIL
  const memberNo = parseMemberNo(value)
  if (memberNo) return `${memberCode(memberNo).toLowerCase()}@members.kislap.app`
  const adviser = value.toLowerCase()
  if (/^[a-z]+(?:\.[a-z]+)+$/.test(adviser)) return `${adviser}@advisers.kislap.app`
  return null
}

export function canSeeTracker(profile, settings, isAdmin, pageAccess = []) {
  if (isAdmin) return true
  if (!profile) return false
  if ((pageAccess || []).includes('tracker')) return true
  const roles = settings?.tracker_roles || []
  const members = settings?.tracker_member_nos || []
  return roles.includes(profile.role) || members.includes(profile.member_no)
}

export function canAccessStaffPage(page, { isAdmin, isAdviser, profile, settings, pageAccess }) {
  if (isAdmin) return true
  if ((page === 'members' || page === 'assign') && isAdviser) return true
  if ((pageAccess || []).includes(page)) return true
  if (page === 'tracker') return canSeeTracker(profile, settings, false, pageAccess)
  return false
}
