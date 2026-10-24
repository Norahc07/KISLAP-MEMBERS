import { listedOnTracker, memberCode, normName } from './tracker'

export const OPEN_MEMBER_NO = 23

export function tallyRoster({ members = [], tracker = [], profiles = [], adviserIds = [] }) {
  const advisers = new Set(adviserIds.filter(Boolean))
  const linked = new Set(tracker.map((row) => row.member_id).filter(Boolean))
  const named = tracker.filter((row) => listedOnTracker(row) && String(row.full_name || '').trim())
  const namedNorms = new Set(named.map((row) => normName(row.full_name)))

  const unlinked = members.filter((member) => {
    if (advisers.has(member.id)) return false
    const name = String(member.full_name || '').trim()
    if (!name || linked.has(member.id)) return false
    return !namedNorms.has(normName(name))
  })

  const accounts = profiles.filter((row) => row.role !== 'admin')
  const accountNorms = new Set([
    ...namedNorms,
    ...unlinked.map((member) => normName(member.full_name)),
  ])
  const extraAccounts = accounts.filter((row) => {
    if (row.member_no || row.role === 'adviser') return false
    const norm = normName(row.full_name)
    return !norm || !accountNorms.has(norm)
  })

  const withoutId = [
    ...unlinked.map((member) => ({
      id: `member-${member.id}`,
      name: member.full_name,
      photo: member.photo_url || '',
    })),
    ...extraAccounts.map((row) => ({
      id: `account-${row.id}`,
      name: row.full_name || row.username,
      photo: row.photo_url || '',
    })),
  ]

  return {
    members: named.length + withoutId.length,
    withId: named.length,
    withoutId: withoutId.length,
    withoutIdPeople: withoutId,
    openSlot: memberCode(OPEN_MEMBER_NO),
    advisers: advisers.size,
    users: accounts.length,
    submitted: tracker.filter((row) => row.registration_form).length,
  }
}
