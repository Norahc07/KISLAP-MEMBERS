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
  const [year, month, day] = String(value || '').split('-').map(Number)
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

export function mapBirthdays(rows = [], year) {
  return (rows || [])
    .filter((row) => row.birth_month && row.birth_day)
    .map((row) => ({
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

export function yearHolidayCount(year) {
  return philippineHolidays(year).length
}
