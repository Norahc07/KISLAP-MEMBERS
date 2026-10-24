import { parseMemberNo } from './registration'
import { memberCode } from './tracker'

export const ADMIN_USERNAME = 'admin'
export const ADMIN_EMAIL = 'admin@admin.com'
export const TRACKER_ACCESS_ROLES = ['officer', 'director', 'assistant', 'member']

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

export function canSeeTracker(profile, settings, isAdmin) {
  if (isAdmin) return true
  if (!profile) return false
  const roles = settings?.tracker_roles || []
  const members = settings?.tracker_member_nos || []
  return roles.includes(profile.role) || members.includes(profile.member_no)
}
