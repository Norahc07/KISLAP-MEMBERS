import { memberCode } from './tracker'
import { holidaysForMonth, philippineHolidays } from './holidays'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export { MONTH_NAMES, WEEKDAYS }

export function startOfMonth(year, month) {
  return new Date(year, month - 1, 1)
}

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

export function toIsoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseIsoDate(value) {
  const raw = String(value || '').slice(0, 10)
  const [year, month, day] = raw.split('-').map(Number)
  if (!year || !month || !day) return null
  return { year, month, day }
}

export function todayParts() {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    iso: toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate()),
  }
}

export function buildMonthCells(year, month) {
  const first = startOfMonth(year, month)
  const total = daysInMonth(year, month)
  const lead = first.getDay()
  const cells = []

  for (let i = 0; i < lead; i += 1) cells.push(null)
  for (let day = 1; day <= total; day += 1) {
    cells.push({
      day,
      iso: toIsoDate(year, month, day),
      month,
      year,
    })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function displayName(row) {
  if (row.full_name && String(row.full_name).trim()) return String(row.full_name).trim()
  const parts = [row.first_name, row.middle_name, row.surname, row.suffix]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
  if (parts.length) return parts.join(' ')
  return row.member_no ? memberCode(row.member_no) : 'Member'
}

/** Normalize RPC rows or raw /registrations rows into birthday records. */
export function normalizeBirthdayRows(rows = []) {
  const byMember = new Map()

  ;(rows || []).forEach((row) => {
    const memberNo = Number(row.member_no)
    if (!memberNo) return

    let month = Number(row.birth_month)
    let day = Number(row.birth_day)
    let year = Number(row.birth_year)

    if ((!month || !day) && (row.date_of_birth || row.dateOfBirth)) {
      const parsed = parseIsoDate(row.date_of_birth || row.dateOfBirth)
      if (!parsed) return
      month = parsed.month
      day = parsed.day
      year = parsed.year
    }

    if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return

    byMember.set(memberNo, {
      member_no: memberNo,
      full_name: displayName(row),
      birth_month: month,
      birth_day: day,
      birth_year: year || null,
      application_status: row.application_status || null,
    })
  })

  return [...byMember.values()].sort(
    (a, b) => a.birth_month - b.birth_month || a.birth_day - b.birth_day || a.member_no - b.member_no,
  )
}

export function mapBirthdays(rows = [], year) {
  return normalizeBirthdayRows(rows).map((row) => ({
    id: `bday-${row.member_no}`,
    type: 'birthday',
    memberNo: row.member_no,
    code: memberCode(row.member_no),
    name: row.full_name || memberCode(row.member_no),
    month: row.birth_month,
    day: row.birth_day,
    birthYear: row.birth_year || null,
    date: toIsoDate(year, row.birth_month, row.birth_day),
    turningAge: row.birth_year ? year - row.birth_year : null,
  }))
}

export function eventsForDay(iso, holidays, birthdays) {
  const holidaysOn = (holidays || []).filter((item) => item.date === iso)
  const birthdaysOn = (birthdays || []).filter((item) => item.date === iso)
  return { holidays: holidaysOn, birthdays: birthdaysOn, count: holidaysOn.length + birthdaysOn.length }
}

export function monthEventBuckets(year, month, birthdayRows) {
  const holidays = holidaysForMonth(year, month)
  const birthdays = mapBirthdays(birthdayRows, year).filter((item) => item.month === month)
  const byDate = {}

  ;[...holidays, ...birthdays].forEach((event) => {
    if (!byDate[event.date]) byDate[event.date] = { holidays: [], birthdays: [] }
    if (event.type === 'holiday') byDate[event.date].holidays.push(event)
    else byDate[event.date].birthdays.push(event)
  })

  return { holidays, birthdays, byDate }
}

export function upcomingInMonth(year, month, birthdayRows, fromDay = 1) {
  const { holidays, birthdays } = monthEventBuckets(year, month, birthdayRows)
  return [...holidays, ...birthdays]
    .filter((event) => event.day >= fromDay)
    .sort((a, b) => a.day - b.day || (a.type === 'holiday' ? -1 : 1))
}

export function allBirthdaysInYear(year, birthdayRows) {
  return mapBirthdays(birthdayRows, year)
}

export function yearHolidayCount(year) {
  return philippineHolidays(year).length
}
