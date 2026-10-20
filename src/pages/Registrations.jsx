import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, ClipboardList, Search } from 'lucide-react'
import Avatar from '../components/Avatar'
import DateField from '../components/DateField'
import RegistrationPrint from '../components/RegistrationPrint'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { fetchTracker } from '../lib/api'
import { errorMessage } from '../lib/constants'
import { fromRow, toPayload } from '../lib/registration'
import { TRACKER_ROLES, listedOnTracker, memberCode } from '../lib/tracker'
import { supabase } from '../supabaseClient'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'missing', label: 'Not yet' },
]

export default function Registrations() {
  const { rolesByMember } = useData()
  const toast = useToast()
  const [roster, setRoster] = useState([])
  const [members, setMembers] = useState([])
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    try {
      const [tracker, registrations] = await Promise.all([
        fetchTracker(),
        supabase.from('registrations').select('*'),
      ])
      if (registrations.error) throw registrations.error
      setRoster(tracker.rows)
      setMembers(tracker.members)
      setForms(registrations.data || [])
      setError('')
    } catch (err) {
      setError(err?.code === 'PGRST205' ? 'missing' : errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members])
  const formsByNo = useMemo(() => new Map(forms.map((row) => [row.member_no, row])), [forms])

  const people = useMemo(() => {
    return roster
      .filter((row) => listedOnTracker(row) && (row.full_name.trim() || formsByNo.has(row.member_no)))
      .map((row) => {
        const registration = formsByNo.get(row.member_no) || null
        const person = row.member_id ? membersById.get(row.member_id) : null
        return {
          tracker: row,
          registration,
          photo: person?.photo_url || null,
          name: row.full_name.trim() || 'No name yet',
          position: positionOf(row, rolesByMember),
          status: statusOf(registration),
        }
      })
      .sort((a, b) => a.tracker.member_no - b.tracker.member_no)
  }, [formsByNo, membersById, roster, rolesByMember])

  const submittedCount = people.filter((person) => person.registration).length
  const missingCount = people.length - submittedCount
  const q = query.trim().toLowerCase()
  const visible = people.filter((person) => {
    if (filter === 'submitted' && !person.registration) return false
    if (filter === 'missing' && person.registration) return false
    if (!q) return true
    return (
      person.name.toLowerCase().includes(q)
      || memberCode(person.tracker.member_no).toLowerCase().includes(q)
      || person.position.toLowerCase().includes(q)
    )
  })

  if (selected) {
    return (
      <RegistrationReview
        person={people.find((person) => person.tracker.member_no === selected) || null}
        onBack={() => setSelected(null)}
        onSaved={() => {
          setSelected(null)
          load()
          toast.success('Organization review saved')
        }}
      />
    )
  }

  return (
    <div className="page page-wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>eRegForms</h1>
          <p className="muted">Submitted membership forms, and who still needs to send one.</p>
        </div>
      </header>

      <section className="stats">
        <article className="stat stat-green">
          <span className="stat-icon"><ClipboardList size={20} /></span>
          <div>
            <strong>{submittedCount}</strong>
            <span>Submitted</span>
          </div>
        </article>
        <article className="stat stat-amber">
          <span className="stat-icon"><ClipboardList size={20} /></span>
          <div>
            <strong>{missingCount}</strong>
            <span>Not yet</span>
          </div>
        </article>
      </section>

      {error === 'missing' && <div className="alert">Run <code>supabase/registration-form.sql</code> in the Supabase SQL Editor, then refresh this page.</div>}
      {error && error !== 'missing' && <div className="alert">{error}</div>}

      <div className="toolbar">
        <div className="search">
          <Search size={17} />
          <input placeholder="Search name, member ID, or position" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="segmented">
          {FILTERS.map((item) => (
            <button key={item.key} type="button" className={filter === item.key ? 'active' : ''} onClick={() => setFilter(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="skeleton-card">
          <div className="skeleton line w80" />
          <div className="skeleton line w60" />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Profile</th>
                <th>Name</th>
                <th>Position</th>
                <th>Member ID</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((person) => (
                <tr key={person.tracker.member_no}>
                  <td><Avatar src={person.photo} name={person.name} size={40} /></td>
                  <td><strong>{person.name}</strong></td>
                  <td>{person.position}</td>
                  <td className="member-code">{memberCode(person.tracker.member_no)}</td>
                  <td><span className={`badge badge-${person.status.key}`}>{person.status.label}</span></td>
                  <td>
                    {person.registration ? (
                      <button type="button" className="btn btn-soft btn-sm" onClick={() => setSelected(person.tracker.member_no)}>
                        Review
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td colSpan={6}>No members match this list.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RegistrationReview({ person, onBack, onSaved }) {
  const [confirmed, setConfirmed] = useState(false)
  const [form, setForm] = useState(() => (person?.registration ? fromRow(person.registration) : null))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setConfirmed(false)
    setForm(person?.registration ? fromRow(person.registration) : null)
    setError('')
  }, [person])

  if (!person?.registration || !form) {
    return (
      <div className="page page-wide">
        <button type="button" className="btn btn-ghost" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <p className="muted">This registration is no longer available.</p>
      </div>
    )
  }

  function setField(key) {
    return (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  }

  async function saveReview() {
    setSaving(true)
    setError('')
    const { error: saveError } = await supabase.rpc('submit_registration', { payload: toPayload(form) })
    setSaving(false)
    if (saveError) {
      setError(
        saveError.code === 'PGRST202'
          ? 'The registration form is not set up in Supabase yet. Run supabase/registration-form.sql.'
          : errorMessage(saveError),
      )
      return
    }
    supabase.rpc('log_audit', {
      p_action: 'registration_reviewed',
      p_summary: `Reviewed the registration for ${memberCode(person.tracker.member_no)}`,
      p_detail: {
        member_no: person.tracker.member_no,
        application_status: form.applicationStatus || null,
        assigned_position: form.assignedPosition,
      },
    }).then(() => {}, () => {})
    onSaved()
  }

  return (
    <div className="page page-wide reg-review">
      <div className="page-header">
        <div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
            <ArrowLeft size={16} /> All eRegForms
          </button>
          <h1>{person.name}</h1>
          <p className="muted">{memberCode(person.tracker.member_no)} · {person.position}</p>
        </div>
        <span className={`badge badge-${person.status.key}`}>{person.status.label}</span>
      </div>

      <RegistrationPrint form={form} preview />

      {!confirmed ? (
        <section className="reg-confirm">
          <div>
            <strong>Confirm this registration</strong>
            <p className="muted">Check the form above. Organization review opens after you confirm it.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setConfirmed(true)}>
            <CheckCircle2 size={16} /> Confirm and review
          </button>
        </section>
      ) : (
        <OrganizationReview form={form} setField={setField} setForm={setForm} saving={saving} error={error} onSave={saveReview} />
      )}
    </div>
  )
}

function OrganizationReview({ form, setField, setForm, saving, error, onSave }) {
  const { units, positionsByUnit, loading } = useData()
  const registered = units.flatMap((unit) =>
    (positionsByUnit.get(unit.id) || []).map((position) => `${position.title} — ${unit.name}`),
  )
  const known = registered.includes(form.assignedPosition)

  return (
    <section className="reg-org">
      <h2>Organization review</h2>
      <p className="muted">Set the application status to Approved to let the member open the e-registration form.</p>
      <div className="field-row">
        <DateField label="Date received" value={form.dateReceived} onChange={(iso) => setForm((current) => ({ ...current, dateReceived: iso }))} />
        <DateField label="Interview date" value={form.interviewDate} onChange={(iso) => setForm((current) => ({ ...current, interviewDate: iso }))} />
      </div>
      <Choice label="Application status" value={form.applicationStatus} onChange={setField('applicationStatus')} options={[['pending', 'Pending'], ['approved', 'Approved'], ['declined', 'Declined']]} />
      <Choice label="Interview assessment" value={form.interviewAssessment} onChange={setField('interviewAssessment')} options={[['recommended', 'Recommended'], ['review', 'For further review'], ['not_recommended', 'Not recommended']]} />
      <label className="field">
        <span>Assigned position</span>
        <select className="input" value={form.assignedPosition} onChange={setField('assignedPosition')}>
          <option value="">{loading ? 'Loading positions…' : 'Select a registered position'}</option>
          {form.assignedPosition && !known && <option value={form.assignedPosition}>{form.assignedPosition}</option>}
          {units.map((unit) => {
            const positions = positionsByUnit.get(unit.id) || []
            if (!positions.length) return null
            return (
              <optgroup key={unit.id} label={unit.name}>
                {positions.map((position) => {
                  const label = `${position.title} — ${unit.name}`
                  return <option key={position.id} value={label}>{label}</option>
                })}
              </optgroup>
            )
          })}
        </select>
      </label>
      <div className="field-row">
        <label className="field">
          <span>Reviewed by</span>
          <input className="input" value={form.reviewedBy} onChange={setField('reviewedBy')} placeholder="Officer name" />
        </label>
        <DateField label="Approval date" value={form.approvalDate} onChange={(iso) => setForm((current) => ({ ...current, approvalDate: iso }))} />
      </div>
      {error && <div className="alert">{error}</div>}
      <div className="register-actions">
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save organization review'}
        </button>
      </div>
    </section>
  )
}

function Choice({ label, options, value, onChange }) {
  return (
    <fieldset className="choice-set">
      <legend>{label}</legend>
      <div className="choice-grid">
        {options.map(([option, text]) => (
          <label key={option} className={`choice ${value === option ? 'active' : ''}`}>
            <input type="radio" name={label} value={option} checked={value === option} onChange={onChange} />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function statusOf(registration) {
  if (!registration) return { key: 'muted', label: 'Not yet' }
  if (registration.application_status === 'approved') return { key: 'approved', label: 'Approved' }
  if (registration.application_status === 'declined') return { key: 'declined', label: 'Declined' }
  return { key: 'submitted', label: 'Submitted' }
}

function positionOf(row, rolesByMember) {
  const roles = row.member_id ? rolesByMember.get(row.member_id) || [] : []
  if (roles.length) {
    return roles
      .map(({ position, unit }) => (position.level === 'member' ? `${unit?.name || 'Committee'} · Member` : position.title))
      .join(', ')
  }
  return TRACKER_ROLES.find((item) => item.value === row.tracker_role)?.label || '—'
}
