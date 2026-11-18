import { supabase } from '../supabaseClient'
import { REQUIREMENT_COLUMNS, listedOnTracker, memberCode, requirementsComplete } from './tracker'
import { isUpcomingSkVoter, isWillingMember, isPwdYouth, MAUBAN_BARANGAYS } from './youthProfiling'

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

function topItems(map, limit = 5) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
}

export async function runMembershipOpsAgent(input = {}) {
  const [tracker, registrations] = await Promise.all([
    unwrap(await supabase.from('membership_tracker').select('*').order('member_no')),
    unwrap(
      await supabase
        .from('registrations')
        .select('member_no, surname, first_name, application_status, interview_assessment, updated_at')
        .order('updated_at', { ascending: false }),
    ),
  ])

  const listed = (tracker || []).filter(listedOnTracker)
  const incomplete = listed.filter((row) => String(row.full_name || '').trim() && !requirementsComplete(row))
  const vacantNamed = listed.filter((row) => !String(row.full_name || '').trim())
  const pendingRegs = (registrations || []).filter((row) => row.application_status === 'pending')
  const approvedRegs = (registrations || []).filter((row) => row.application_status === 'approved')

  const gapCounts = Object.fromEntries(REQUIREMENT_COLUMNS.map((column) => [column.key, 0]))
  for (const row of incomplete) {
    for (const column of REQUIREMENT_COLUMNS) {
      if (column.required && !row[column.key]) gapCounts[column.key] += 1
    }
  }

  const checklist = incomplete.slice(0, 12).map((row) => {
    const missing = REQUIREMENT_COLUMNS.filter((column) => column.required && !row[column.key]).map((column) => column.short)
    return {
      member_no: row.member_no,
      code: memberCode(row.member_no),
      name: row.full_name,
      missing,
    }
  })

  const proposals = checklist.slice(0, 5).map((item) => ({
    title: `Tracker follow-up: ${item.code}`,
    detail: `${item.name} still needs: ${item.missing.join(', ') || 'requirements'}.`,
    proposal_type: 'tracker_reminder',
    payload: { member_no: item.member_no, missing: item.missing },
  }))

  if (pendingRegs.length) {
    proposals.push({
      title: `Review ${pendingRegs.length} pending eRegForm${pendingRegs.length === 1 ? '' : 's'}`,
      detail: pendingRegs
        .slice(0, 8)
        .map((row) => `${memberCode(row.member_no)} — ${[row.first_name, row.surname].filter(Boolean).join(' ')}`)
        .join('; '),
      proposal_type: 'note',
      payload: { pending_count: pendingRegs.length },
    })
  }

  const focusMember = Number(input.member_no) || null
  let focusNote = ''
  if (focusMember) {
    const row = listed.find((item) => item.member_no === focusMember)
    if (row) {
      const missing = REQUIREMENT_COLUMNS.filter((column) => column.required && !row[column.key]).map((column) => column.label)
      focusNote = missing.length
        ? ` Focus: ${memberCode(focusMember)} (${row.full_name || 'unnamed'}) still missing ${missing.join(', ')}.`
        : ` Focus: ${memberCode(focusMember)} checklist looks complete.`
    }
  }

  const summary = [
    `Membership Ops reviewed ${listed.length} tracker seats.`,
    `${incomplete.length} named member${incomplete.length === 1 ? '' : 's'} have incomplete required checklist items.`,
    `${pendingRegs.length} eRegForm${pendingRegs.length === 1 ? '' : 's'} pending review; ${approvedRegs.length} approved.`,
    vacantNamed.length ? `${vacantNamed.length} vacant listed seat${vacantNamed.length === 1 ? '' : 's'}.` : '',
    focusNote,
  ]
    .filter(Boolean)
    .join(' ')

  return {
    summary,
    result: {
      tracker_listed: listed.length,
      incomplete_count: incomplete.length,
      pending_registrations: pendingRegs.length,
      approved_registrations: approvedRegs.length,
      gap_counts: gapCounts,
      checklist,
      generated_at: new Date().toISOString(),
      mode: 'deterministic',
    },
    proposals,
  }
}

export async function runYouthInsightsAgent(input = {}) {
  const [profilesResult, statsResult] = await Promise.all([
    supabase.from('youth_profiles').select('barangay, age_band, volunteer_interest, membership_interest, pwd, status'),
    supabase.rpc('youth_profiling_barangay_stats'),
  ])

  if (profilesResult.error) throw profilesResult.error
  const profiles = (profilesResult.data || []).filter((row) => row.status !== 'draft')
  const stats = statsResult.error ? [] : statsResult.data || []

  const interested = profiles.filter((row) => row.volunteer_interest === 'yes').length
  const willing = profiles.filter(isWillingMember).length
  const pwd = profiles.filter(isPwdYouth).length
  const upcomingSk = profiles.filter(isUpcomingSkVoter).length
  const covered = new Set(profiles.map((row) => row.barangay).filter(Boolean))
  const uncovered = MAUBAN_BARANGAYS.filter((name) => !covered.has(name))

  const byBarangay = new Map()
  for (const row of profiles) {
    if (!row.barangay) continue
    byBarangay.set(row.barangay, (byBarangay.get(row.barangay) || 0) + 1)
  }
  const topBarangays = topItems(byBarangay, 5)

  const joinByBarangay = new Map()
  for (const row of stats) {
    const value = Number(row.interested_to_join || row.volunteer_yes || 0)
    if (value > 0) joinByBarangay.set(row.barangay, value)
  }
  const topJoin = topItems(joinByBarangay, 5)

  const focusBarangay = String(input.barangay || '').trim()
  let focusNote = ''
  if (focusBarangay) {
    const count = byBarangay.get(focusBarangay) || 0
    const join = joinByBarangay.get(focusBarangay) || 0
    focusNote = ` Focus barangay ${focusBarangay}: ${count} profile${count === 1 ? '' : 's'}, ${join} Interested to Join.`
  }

  const proposals = []
  if (uncovered.length) {
    proposals.push({
      title: `Expand profiling to ${Math.min(5, uncovered.length)} uncovered barangay${uncovered.length === 1 ? '' : 's'}`,
      detail: `No submitted profiles yet in: ${uncovered.slice(0, 8).join(', ')}${uncovered.length > 8 ? '…' : ''}.`,
      proposal_type: 'outreach',
      payload: { barangays: uncovered.slice(0, 8) },
    })
  }
  if (willing > 0) {
    proposals.push({
      title: `${willing} youth signaled membership interest`,
      detail: 'Review Willing-to-join list and plan orientation outreach.',
      proposal_type: 'outreach',
      payload: { willing_count: willing },
    })
  }
  if (upcomingSk > 0) {
    proposals.push({
      title: `${upcomingSk} upcoming SK voter${upcomingSk === 1 ? '' : 's'} (age 14)`,
      detail: 'Use Upcoming SK list for barangay engagement planning.',
      proposal_type: 'note',
      payload: { upcoming_sk: upcomingSk },
    })
  }

  const summary = [
    `Youth Insights reviewed ${profiles.length} submitted profile${profiles.length === 1 ? '' : 's'} across ${covered.size}/40 barangays.`,
    `${interested} Interested to Join, ${willing} membership-interested, ${pwd} PWD, ${upcomingSk} Upcoming SK (14).`,
    uncovered.length ? `${uncovered.length} barangay${uncovered.length === 1 ? '' : 's'} still uncovered.` : 'All 40 barangays have at least one profile.',
    topJoin.length ? `Highest Interested to Join: ${topJoin.map(([name, value]) => `${name} (${value})`).join(', ')}.` : '',
    focusNote,
  ]
    .filter(Boolean)
    .join(' ')

  return {
    summary,
    result: {
      profiles: profiles.length,
      barangays_covered: covered.size,
      interested_to_join: interested,
      membership_interested: willing,
      pwd,
      upcoming_sk: upcomingSk,
      uncovered_barangays: uncovered,
      top_barangays: topBarangays.map(([name, value]) => ({ barangay: name, profiles: value })),
      top_interested_to_join: topJoin.map(([name, value]) => ({ barangay: name, count: value })),
      generated_at: new Date().toISOString(),
      mode: 'deterministic',
    },
    proposals,
  }
}
