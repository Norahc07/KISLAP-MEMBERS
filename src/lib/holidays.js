/** Philippine regular and special non-working holidays for a given year. */

function pad(n) {
  return String(n).padStart(2, '0')
}

function iso(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Anonymous Gregorian Easter (Meeus/Jones/Butcher). */
function easterSunday(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

function addDays(year, month, day, offset) {
  const date = new Date(Date.UTC(year, month - 1, day + offset))
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }
}

function lastMondayOfAugust(year) {
  const date = new Date(Date.UTC(year, 7, 31))
  while (date.getUTCDay() !== 1) date.setUTCDate(date.getUTCDate() - 1)
  return { month: 8, day: date.getUTCDate() }
}

export function philippineHolidays(year) {
  const easter = easterSunday(year)
  const maundy = addDays(year, easter.month, easter.day, -3)
  const goodFriday = addDays(year, easter.month, easter.day, -2)
  const blackSaturday = addDays(year, easter.month, easter.day, -1)
  const heroes = lastMondayOfAugust(year)

  const rows = [
    { month: 1, day: 1, name: "New Year's Day", kind: 'regular' },
    { month: maundy.month, day: maundy.day, name: 'Maundy Thursday', kind: 'regular' },
    { month: goodFriday.month, day: goodFriday.day, name: 'Good Friday', kind: 'regular' },
    { month: blackSaturday.month, day: blackSaturday.day, name: 'Black Saturday', kind: 'special' },
    { month: 4, day: 9, name: 'Araw ng Kagitingan', kind: 'regular' },
    { month: 5, day: 1, name: 'Labor Day', kind: 'regular' },
    { month: 6, day: 12, name: 'Independence Day', kind: 'regular' },
    { month: 8, day: 21, name: 'Ninoy Aquino Day', kind: 'special' },
    { month: heroes.month, day: heroes.day, name: 'National Heroes Day', kind: 'regular' },
    { month: 11, day: 1, name: "All Saints' Day", kind: 'special' },
    { month: 11, day: 2, name: 'All Souls Day', kind: 'special' },
    { month: 11, day: 30, name: 'Bonifacio Day', kind: 'regular' },
    { month: 12, day: 8, name: 'Feast of the Immaculate Conception', kind: 'special' },
    { month: 12, day: 24, name: 'Christmas Eve', kind: 'special' },
    { month: 12, day: 25, name: 'Christmas Day', kind: 'regular' },
    { month: 12, day: 30, name: 'Rizal Day', kind: 'regular' },
    { month: 12, day: 31, name: "New Year's Eve", kind: 'special' },
  ]

  return rows.map((row) => ({
    id: `holiday-${year}-${row.month}-${row.day}-${row.name}`,
    type: 'holiday',
    kind: row.kind,
    name: row.name,
    date: iso(year, row.month, row.day),
    month: row.month,
    day: row.day,
    year,
  }))
}

export function holidaysForMonth(year, month) {
  return philippineHolidays(year).filter((item) => item.month === month)
}
