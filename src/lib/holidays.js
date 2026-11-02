/** Philippine national holidays, Quezon Province commemorations, and local festivals. */

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

/** Known Chinese New Year dates for nearby years. */
const CHINESE_NEW_YEAR = {
  2024: { month: 2, day: 10 },
  2025: { month: 1, day: 29 },
  2026: { month: 2, day: 17 },
  2027: { month: 2, day: 6 },
  2028: { month: 1, day: 26 },
  2029: { month: 2, day: 13 },
  2030: { month: 2, day: 3 },
  2031: { month: 1, day: 23 },
}

function kindLabel(kind) {
  if (kind === 'regular') return 'Regular holiday'
  if (kind === 'special') return 'Special non-working day'
  if (kind === 'quezon') return 'Quezon Province holiday'
  if (kind === 'festival') return 'Festival / event'
  return 'Holiday'
}

function expandRange(year, month, startDay, endDay, base) {
  const rows = []
  const last = endDay >= startDay ? endDay : startDay
  for (let day = startDay; day <= last; day += 1) {
    rows.push({ ...base, month, day, year })
  }
  return rows
}

function nationalHolidays(year) {
  const easter = easterSunday(year)
  const maundy = addDays(year, easter.month, easter.day, -3)
  const goodFriday = addDays(year, easter.month, easter.day, -2)
  const blackSaturday = addDays(year, easter.month, easter.day, -1)
  const easterMonday = addDays(year, easter.month, easter.day, 1)
  const heroes = lastMondayOfAugust(year)
  const cny = CHINESE_NEW_YEAR[year]

  const rows = [
    { month: 1, day: 1, name: "New Year's Day", kind: 'regular' },
    ...(cny ? [{ month: cny.month, day: cny.day, name: 'Chinese New Year', kind: 'special' }] : []),
    { month: 2, day: 25, name: 'EDSA People Power Anniversary', kind: 'special' },
    { month: maundy.month, day: maundy.day, name: 'Maundy Thursday', kind: 'regular' },
    { month: goodFriday.month, day: goodFriday.day, name: 'Good Friday', kind: 'regular' },
    { month: blackSaturday.month, day: blackSaturday.day, name: 'Black Saturday', kind: 'special' },
    { month: easter.month, day: easter.day, name: 'Easter Sunday', kind: 'special' },
    { month: easterMonday.month, day: easterMonday.day, name: 'Easter Monday', kind: 'special' },
    { month: 4, day: 9, name: 'Araw ng Kagitingan', kind: 'regular' },
    { month: 5, day: 1, name: 'Labor Day', kind: 'regular' },
    { month: 6, day: 12, name: 'Independence Day', kind: 'regular' },
    { month: 8, day: 19, name: 'Manuel L. Quezon Day', kind: 'special' },
    { month: 8, day: 21, name: 'Ninoy Aquino Day', kind: 'special' },
    { month: heroes.month, day: heroes.day, name: 'National Heroes Day', kind: 'regular' },
    { month: 11, day: 1, name: "All Saints' Day", kind: 'special' },
    { month: 11, day: 2, name: "All Souls' Day", kind: 'special' },
    { month: 11, day: 30, name: 'Bonifacio Day', kind: 'regular' },
    { month: 12, day: 8, name: 'Feast of the Immaculate Conception', kind: 'special' },
    { month: 12, day: 24, name: 'Christmas Eve', kind: 'special' },
    { month: 12, day: 25, name: 'Christmas Day', kind: 'regular' },
    { month: 12, day: 30, name: 'Rizal Day', kind: 'regular' },
    { month: 12, day: 31, name: "New Year's Eve", kind: 'special' },
  ]

  return rows.map((row) => toEvent(year, row))
}

function quezonHolidays(year) {
  const rows = [
    { month: 3, day: 2, name: 'Quezon Province Foundation Day', kind: 'quezon', place: 'Quezon Province' },
    { month: 8, day: 19, name: 'Manuel L. Quezon Birthday (Quezon)', kind: 'quezon', place: 'Quezon Province' },
    {
      month: 11,
      day: 4,
      name: 'Hermano Puli Day',
      kind: 'quezon',
      place: 'Quezon Province',
      note: 'Death anniversary of Apolinario de la Cruz (Hermano Puli)',
    },
    { month: 11, day: 12, name: 'Gumaca Founding Anniversary', kind: 'quezon', place: 'Gumaca, Quezon' },
  ]
  return rows.map((row) => toEvent(year, row))
}

function quezonFestivals(year) {
  const specs = [
    { month: 2, start: 1, end: 5, name: 'Taytsinoy Festival', place: 'Tayabas City' },
    { month: 2, start: 2, end: 2, name: 'Candle Festival', place: 'Candelaria' },
    { month: 2, start: 5, end: 11, name: 'Kaway Festival', place: 'Tagkawayan' },
    { month: 2, start: 7, end: 7, name: 'Laguimanoc Festival', place: 'Padre Burgos' },
    { month: 3, start: 3, end: 5, name: 'Boling-Boling Festival', place: 'Catanauan' },
    { month: 3, start: 17, end: 17, name: 'Tariktik Festival', place: 'Polillo' },
    { month: 4, start: 18, end: 19, name: 'Centurion Festival', place: 'San Narciso / Mulanay / General Luna' },
    { month: 4, start: 18, end: 19, name: 'Kubol ng Macalelon', place: 'Macalelon' },
    { month: 4, start: 19, end: 19, name: 'Buhay na Kubol', place: 'General Luna' },
    { month: 4, start: 21, end: 21, name: 'Buhusan Festival', place: 'Lucban' },
    { month: 4, start: 25, end: 28, name: 'Hambujan Festival', place: 'Dolores' },
    { month: 4, start: 26, end: 30, name: 'Pamaypayan Festival', place: 'Lopez' },
    { month: 5, start: 15, end: 15, name: 'Pahiyas Festival', place: 'Lucban' },
    { month: 5, start: 15, end: 15, name: 'Agawan Festival', place: 'Sariaya' },
    { month: 5, start: 15, end: 15, name: "Araña't Baluarte Festival", place: 'Gumaca' },
    { month: 5, start: 15, end: 15, name: 'Mayohan sa Tayabas', place: 'Tayabas City' },
    { month: 5, start: 15, end: 15, name: 'Coconut Festival', place: 'Alabat' },
    { month: 5, start: 21, end: 25, name: 'Alimango Festival', place: 'Calauag' },
    { month: 5, start: 28, end: 28, name: 'Pasayahan sa Lucena', place: 'Lucena City' },
    { month: 6, start: 10, end: 12, name: 'Kayakas Festival', place: 'Perez' },
    { month: 6, start: 20, end: 20, name: 'Gayang Festival', place: 'Guinayangan' },
    { month: 6, start: 24, end: 24, name: 'Mais Festival', place: 'Tiaong' },
    { month: 7, start: 14, end: 15, name: 'Maubanog Festival', place: 'Mauban' },
    { month: 8, start: 1, end: 1, name: 'Tagultol Fishing Festival', place: 'Atimonan' },
    { month: 8, start: 10, end: 17, name: 'Niyogyugan Festival', place: 'Lucena City / Quezon Province' },
    { month: 8, start: 15, end: 15, name: 'Palay Iskad Festival', place: 'Buenavista' },
    { month: 8, start: 20, end: 20, name: 'Maisan Festival', place: 'San Andres' },
    { month: 8, start: 29, end: 30, name: 'Papag at Bilao Festival', place: 'Pagbilao' },
    { month: 9, start: 15, end: 15, name: 'Aguyod Festival', place: 'Tayabas City' },
    { month: 10, start: 3, end: 3, name: 'San Antonio Founding Anniversary', place: 'San Antonio' },
    { month: 12, start: 12, end: 24, name: 'Paskong Payas Festival', place: 'Lucban' },
  ]

  const rows = []
  specs.forEach((spec) => {
    expandRange(year, spec.month, spec.start, spec.end, {
      name: spec.name,
      kind: 'festival',
      place: spec.place,
      note: spec.start !== spec.end ? `${pad(spec.start)}–${pad(spec.end)} ${monthName(spec.month)}` : null,
    }).forEach((row) => rows.push(row))
  })

  return rows.map((row) => toEvent(year, row))
}

function monthName(month) {
  return [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ][month - 1]
}

function toEvent(year, row) {
  return {
    id: `${row.kind}-${year}-${row.month}-${row.day}-${row.name}`,
    type: 'holiday',
    kind: row.kind,
    name: row.name,
    place: row.place || null,
    note: row.note || null,
    label: kindLabel(row.kind),
    date: iso(year, row.month, row.day),
    month: row.month,
    day: row.day,
    year,
  }
}

export function philippineHolidays(year) {
  const merged = [...nationalHolidays(year), ...quezonHolidays(year), ...quezonFestivals(year)]
  const seen = new Set()
  return merged
    .filter((item) => {
      const key = `${item.date}|${item.name}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.month - b.month || a.day - b.day || a.name.localeCompare(b.name))
}

export function holidaysForMonth(year, month) {
  return philippineHolidays(year).filter((item) => item.month === month)
}

export { kindLabel }
