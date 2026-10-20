import { useEffect, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'
import { isValidDate } from '../lib/registration'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function DateField({ label, value, onChange }) {
  const selected = isValidDate(value) ? value : ''
  const today = new Date()
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() => (selected || todayIso()).slice(0, 7))
  const root = useRef(null)
  const [year, month] = cursor.split('-').map(Number)
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const years = []
  for (let item = today.getFullYear() + 2; item >= 1940; item -= 1) years.push(item)

  useEffect(() => {
    if (!open) return undefined
    function close(event) {
      if (!root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  function pick(day) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    onChange(iso)
    setOpen(false)
  }

  function shiftMonth(amount) {
    const next = new Date(year, month - 1 + amount, 1)
    setCursor(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="field date-field" ref={root}>
      <span>{label}</span>
      <button type="button" className="input date-trigger" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <Calendar size={16} />
        {selected ? formatLongDate(selected) : 'Select a date'}
      </button>
      {open && (
        <div className="date-popover">
          <div className="date-popover-bar">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
            <select value={month} onChange={(event) => setCursor(`${year}-${String(event.target.value).padStart(2, '0')}`)} aria-label="Month">
              {MONTHS.map((name, index) => (
                <option key={name} value={index + 1}>{name}</option>
              ))}
            </select>
            <select value={year} onChange={(event) => setCursor(`${event.target.value}-${String(month).padStart(2, '0')}`)} aria-label="Year">
              {years.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
          </div>
          <div className="date-grid">
            {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
            {Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1
              const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              return (
                <button key={day} type="button" className={iso === selected ? 'selected' : ''} onClick={() => pick(day)}>
                  {day}
                </button>
              )
            })}
          </div>
          <button type="button" className="date-clear" onClick={() => { onChange(''); setOpen(false) }}>Clear date</button>
        </div>
      )}
    </div>
  )
}

function formatLongDate(iso) {
  const [year, month, day] = iso.split('-')
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`
}

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
