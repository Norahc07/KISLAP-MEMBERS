import { useEffect, useMemo, useState } from 'react'
import { Cake, CalendarDays, ChevronLeft, ChevronRight, PartyPopper } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { errorMessage } from '../lib/constants'
import {
  MONTH_NAMES,
  WEEKDAYS,
  allBirthdaysInYear,
  buildMonthCells,
  monthEventBuckets,
  normalizeBirthdayRows,
  todayParts,
  upcomingInMonth,
} from '../lib/calendar'
import { memberCode } from '../lib/tracker'

async function loadBirthdaySource() {
  const rpc = await supabase.rpc('list_calendar_birthdays')
  if (!rpc.error) {
    const rows = normalizeBirthdayRows(rpc.data || [])
    if (rows.length) return { rows, source: 'rpc' }
  }

  // Same source as /registrations Preview — date_of_birth on each eRegForm.
  const [{ data: registrations, error: regError }, { data: tracker }] = await Promise.all([
    supabase
      .from('registrations')
      .select('member_no, date_of_birth, first_name, middle_name, surname, suffix, application_status')
      .not('date_of_birth', 'is', null)
      .order('member_no'),
    supabase.from('membership_tracker').select('member_no, full_name'),
  ])

  if (regError) {
    if (rpc.error) {
      return {
        rows: [],
        error:
          rpc.error.code === 'PGRST202'
            ? 'Run supabase/calendar.sql in the Supabase SQL Editor, then refresh.'
            : errorMessage(rpc.error),
      }
    }
    return { rows: [], error: errorMessage(regError) }
  }

  const names = new Map((tracker || []).map((row) => [row.member_no, row.full_name]))
  const merged = (registrations || []).map((row) => ({
    ...row,
    full_name: names.get(row.member_no) || null,
  }))

  return { rows: normalizeBirthdayRows(merged), source: 'registrations' }
}

export default function CalendarPage() {
  const today = todayParts()
  const [cursor, setCursor] = useState({ year: today.year, month: today.month })
  const [selected, setSelected] = useState(today.iso)
  const [birthdayRows, setBirthdayRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    setLoading(true)
    loadBirthdaySource().then((result) => {
      if (!live) return
      setBirthdayRows(result.rows || [])
      setError(result.error || '')
      setLoading(false)
    })
    return () => {
      live = false
    }
  }, [])

  const { year, month } = cursor
  const cells = useMemo(() => buildMonthCells(year, month), [year, month])
  const { byDate, holidays, birthdays } = useMemo(
    () => monthEventBuckets(year, month, birthdayRows),
    [year, month, birthdayRows],
  )
  const yearBirthdays = useMemo(() => allBirthdaysInYear(year, birthdayRows), [year, birthdayRows])

  const selectedParts = selected?.startsWith(`${year}-${String(month).padStart(2, '0')}`)
    ? selected
    : null
  const selectedEvents = selectedParts ? byDate[selectedParts] || { holidays: [], birthdays: [] } : { holidays: [], birthdays: [] }

  const fromDay = year === today.year && month === today.month ? today.day : 1
  const upcoming = useMemo(
    () => upcomingInMonth(year, month, birthdayRows, fromDay),
    [year, month, birthdayRows, fromDay],
  )

  function shiftMonth(delta) {
    setCursor((current) => {
      const date = new Date(current.year, current.month - 1 + delta, 1)
      return { year: date.getFullYear(), month: date.getMonth() + 1 }
    })
  }

  function goToday() {
    setCursor({ year: today.year, month: today.month })
    setSelected(today.iso)
  }

  return (
    <div className="page page-wide calendar-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Organization</p>
          <h1>Calendar</h1>
          <p className="muted">
            Philippine holidays and member birthdays from e-registration forms
            {birthdayRows.length ? ` · ${birthdayRows.length} birthday${birthdayRows.length === 1 ? '' : 's'} loaded` : ''}.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-soft" onClick={goToday}>
            Today
          </button>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}

      <div className="calendar-layout">
        <section className="panel calendar-board">
          <div className="calendar-toolbar">
            <button type="button" className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeft size={18} />
            </button>
            <h2>
              {MONTH_NAMES[month - 1]} {year}
            </h2>
            <button type="button" className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="calendar-legend">
            <span className="calendar-legend-item is-holiday">
              <PartyPopper size={14} /> Holiday
            </span>
            <span className="calendar-legend-item is-birthday">
              <Cake size={14} /> Birthday
            </span>
          </div>

          <div className="calendar-weekdays">
            {WEEKDAYS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          {loading ? (
            <div className="calendar-loading">
              <div className="spinner" />
              <p className="muted">Loading calendar…</p>
            </div>
          ) : (
            <div className="calendar-grid">
              {cells.map((cell, index) => {
                if (!cell) return <div key={`empty-${index}`} className="calendar-cell is-empty" />
                const bucket = byDate[cell.iso] || { holidays: [], birthdays: [] }
                const hasHoliday = bucket.holidays.length > 0
                const hasBirthday = bucket.birthdays.length > 0
                const isToday = cell.iso === today.iso
                const isSelected = cell.iso === selected
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    className={`calendar-cell${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}${hasHoliday ? ' has-holiday' : ''}${hasBirthday ? ' has-birthday' : ''}`}
                    onClick={() => setSelected(cell.iso)}
                  >
                    <span className="calendar-day-num">{cell.day}</span>
                    <span className="calendar-dots">
                      {hasHoliday ? <i className="calendar-dot holiday" /> : null}
                      {hasBirthday ? <i className="calendar-dot birthday" /> : null}
                    </span>
                    <span className="calendar-cell-labels">
                      {bucket.holidays.slice(0, 1).map((event) => (
                        <em key={event.id} className="is-holiday">
                          {event.name}
                        </em>
                      ))}
                      {bucket.birthdays.slice(0, 1).map((event) => (
                        <em key={event.id} className="is-birthday">
                          {event.name.split(' ')[0]}
                        </em>
                      ))}
                      {bucket.holidays.length + bucket.birthdays.length > 1 ? (
                        <em className="is-more">+{bucket.holidays.length + bucket.birthdays.length - 1}</em>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <aside className="calendar-side">
          <section className="panel calendar-day-panel">
            <div className="calendar-side-head">
              <CalendarDays size={18} />
              <div>
                <p className="eyebrow">Selected day</p>
                <h2>
                  {selected
                    ? new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Pick a day'}
                </h2>
              </div>
            </div>

            {!selectedEvents.holidays.length && !selectedEvents.birthdays.length ? (
              <p className="muted calendar-empty">No holidays or birthdays on this day.</p>
            ) : (
              <ul className="calendar-event-list">
                {selectedEvents.holidays.map((event) => (
                  <li key={event.id} className="calendar-event is-holiday">
                    <PartyPopper size={16} />
                    <div>
                      <strong>{event.name}</strong>
                      <span>{event.kind === 'regular' ? 'Regular holiday' : 'Special non-working day'}</span>
                    </div>
                  </li>
                ))}
                {selectedEvents.birthdays.map((event) => (
                  <li key={event.id} className="calendar-event is-birthday">
                    <Cake size={16} />
                    <div>
                      <strong>{event.name}</strong>
                      <span>
                        {event.code}
                        {event.turningAge ? ` · turns ${event.turningAge}` : ''}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel calendar-month-panel">
            <div className="calendar-side-head">
              <div>
                <p className="eyebrow">This month</p>
                <h2>
                  {holidays.length} holiday{holidays.length === 1 ? '' : 's'} · {birthdays.length} birthday
                  {birthdays.length === 1 ? '' : 's'}
                </h2>
              </div>
            </div>

            {!upcoming.length ? (
              <p className="muted calendar-empty">
                {year === today.year && month === today.month
                  ? 'No more holidays or birthdays left this month.'
                  : 'No holidays or birthdays this month.'}
              </p>
            ) : (
              <ul className="calendar-event-list">
                {upcoming.map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      className={`calendar-event calendar-event-btn ${event.type === 'holiday' ? 'is-holiday' : 'is-birthday'}`}
                      onClick={() => setSelected(event.date)}
                    >
                      {event.type === 'holiday' ? <PartyPopper size={16} /> : <Cake size={16} />}
                      <div>
                        <strong>{event.name}</strong>
                        <span>
                          {MONTH_NAMES[event.month - 1]} {event.day}
                          {event.type === 'birthday' ? ` · ${event.code}` : ''}
                          {event.type === 'birthday' && event.turningAge ? ` · turns ${event.turningAge}` : ''}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel calendar-year-panel">
            <div className="calendar-side-head">
              <div>
                <p className="eyebrow">All birthdays · {year}</p>
                <h2>
                  {yearBirthdays.length
                    ? `${yearBirthdays.length} member${yearBirthdays.length === 1 ? '' : 's'} from eRegForms`
                    : 'No birthdays loaded yet'}
                </h2>
              </div>
            </div>

            {!yearBirthdays.length ? (
              <p className="muted calendar-empty">
                Birthdays appear here after members submit their date of birth on the registration form.
              </p>
            ) : (
              <ul className="calendar-event-list calendar-year-list">
                {yearBirthdays.map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      className="calendar-event calendar-event-btn is-birthday"
                      onClick={() => {
                        setCursor({ year, month: event.month })
                        setSelected(event.date)
                      }}
                    >
                      <Cake size={16} />
                      <div>
                        <strong>{event.name}</strong>
                        <span>
                          {MONTH_NAMES[event.month - 1]} {event.day}
                          {' · '}
                          {event.code || memberCode(event.memberNo)}
                          {event.turningAge ? ` · turns ${event.turningAge}` : ''}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
