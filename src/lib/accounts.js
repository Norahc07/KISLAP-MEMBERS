import { parseMemberNo } from './registration'
import { memberCode } from './tracker'

export const ADMIN_USERNAME = 'admin'
export const ADMIN_EMAIL = 'admin@admin.com'
export const TRACKER_ACCESS_ROLES = ['officer', 'director', 'assistant', 'member']

/** Admin-side pages and their CRUD / manage actions that can be granted to a member. */
export const STAFF_ACCESS = [
  {
    key: 'documents',
    label: 'Documents',
    path: '/documents',
    nav: false,
    note: 'Everyone can open Documents. Grant Add / Edit / Delete here.',
    actions: [
      { key: 'documents_create', label: 'Add' },
      { key: 'documents_update', label: 'Edit' },
      { key: 'documents_delete', label: 'Delete' },
    ],
  },
  {
    key: 'registrations',
    label: 'eRegForms',
    path: '/registrations',
    nav: true,
    actions: [
      { key: 'registrations_edit', label: 'Edit responses' },
      { key: 'registrations_review', label: 'Review / approve' },
    ],
  },
  {
    key: 'members',
    label: 'Members',
    path: '/members',
    nav: true,
    actions: [
      { key: 'members_create', label: 'Add' },
      { key: 'members_update', label: 'Edit' },
      { key: 'members_delete', label: 'Delete' },
    ],
  },
  {
    key: 'assign',
    label: 'Assign Roles',
    path: '/assign',
    nav: true,
    actions: [{ key: 'assign_write', label: 'Add / edit / assign' }],
  },
  {
    key: 'tracker',
    label: 'Tracker',
    path: '/tracker',
    nav: true,
    actions: [{ key: 'tracker_write', label: 'Edit checklist' }],
  },
  {
    key: 'users',
    label: 'Users',
    path: '/users',
    nav: true,
    actions: [],
  },
  {
    key: 'audit',
    label: 'Audit log',
    path: '/audit',
    nav: true,
    actions: [],
  },
]

export const STAFF_PAGES = STAFF_ACCESS.filter((page) => page.nav)

export const STAFF_PAGE_KEYS = STAFF_ACCESS.map((page) => page.key)

export const STAFF_PERMISSION_KEYS = STAFF_ACCESS.flatMap((page) => [page.key, ...page.actions.map((action) => action.key)])

const LABEL_BY_KEY = Object.fromEntries(
  STAFF_ACCESS.flatMap((page) => [
    [page.key, page.label],
    ...page.actions.map((action) => [action.key, `${page.label}: ${action.label}`]),
  ]),
)

export function staffPageLabel(key) {
  return LABEL_BY_KEY[key] || key
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
  if (page === 'documents') return true
  if ((page === 'members' || page === 'assign') && isAdviser) return true
  if ((pageAccess || []).includes(page)) return true
  if (page === 'tracker') return canSeeTracker(profile, settings, false, pageAccess)
  return false
}

export function canDoStaffAction(action, { isAdmin, pageAccess }) {
  if (isAdmin) return true
  return (pageAccess || []).includes(action)
}

/** Keep page keys when any of their actions are selected. */
export function normalizeStaffPermissions(selected) {
  const set = new Set(selected || [])
  STAFF_ACCESS.forEach((page) => {
    const hasAction = page.actions.some((action) => set.has(action.key))
    if (hasAction) set.add(page.key)
    if (page.nav === false && !hasAction) set.delete(page.key)
  })
  return STAFF_PERMISSION_KEYS.filter((key) => set.has(key))
}
