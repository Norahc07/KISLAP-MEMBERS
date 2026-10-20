import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, Search } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { fetchTracker, updateTracker } from '../lib/api'
import Avatar from '../components/Avatar'
import { errorMessage } from '../lib/constants'
import { REQUIREMENT_COLUMNS, TRACKER_ROLES, listedOnTracker, memberCode, requirementsComplete } from '../lib/tracker'
import { useToast } from '../context/ToastContext'

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'complete', label: 'Complete' },
  { key: 'open', label: 'No name' },
]

export default function Tracker() {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [role, setRole] = useState('all')

  const load = useCallback(async () => {
    try {
      const data = await fetchTracker()
      setRows(data.rows)
      setMembers(data.members)
      setError(null)
    } catch (err) {
      setError(err?.code === 'PGRST205' ? 'missing-table' : errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('membership-tracker')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'membership_tracker' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members])
  const listed = useMemo(() => rows.filter(listedOnTracker), [rows])

  const named = listed.filter((row) => row.full_name.trim())
  const completeCount = named.filter(requirementsComplete).length

  const q = query.trim().toLowerCase()
  const visible = listed.filter((row) => {
    const complete = requirementsComplete(row)
    if (status === 'pending' && (complete || !row.full_name.trim())) return false
    if (status === 'complete' && !complete) return false
    if (status === 'open' && row.full_name.trim()) return false
    if (role !== 'all' && row.tracker_role !== role) return false
    if (!q) return true
    return memberCode(row.member_no).toLowerCase().includes(q) || row.full_name.toLowerCase().includes(q)
  })

  function replaceRow(updated) {
    setRows((current) => current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)))
  }

  async function saveRow(row, values) {
    replaceRow({ ...row, ...values })
    try {
      const updated = await updateTracker(row.id, values)
      replaceRow(updated)
      const changed = Object.keys(values).join(', ')
      supabase.rpc('log_audit', {
        p_action: 'tracker_updated',
        p_summary: `Updated ${memberCode(row.member_no)} (${changed})`,
        p_detail: values,
      }).then(() => {}, () => {})
    } catch (err) {
      toast.error(errorMessage(err))
      load()
    }
  }

  return (
    <div className="page page-wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">Membership</p>
          <h1>Tracker</h1>
          <p className="muted">
            {named.length} named members · {completeCount} complete · {listed.length - named.length} open slots
          </p>
        </div>
      </header>

      <section className="stats">
        <TrackerStat label="Named" value={named.length} tone="blue" />
        <TrackerStat label="Complete" value={completeCount} tone="green" />
        <TrackerStat label="Pending" value={named.length - completeCount} tone="amber" />
        <TrackerStat label="Open slots" value={listed.length - named.length} tone="violet" />
      </section>

      <div className="toolbar">
        <div className="search">
          <Search size={17} />
          <input
            placeholder="Search member ID or name…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="segmented">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.key}
              className={status === filter.key ? 'active' : ''}
              onClick={() => setStatus(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <select className="input input-sm role-filter" value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="all">All positions</option>
          {TRACKER_ROLES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {error === 'missing-table' && (
        <div className="alert">
          The tracker table is not in Supabase yet. Open the SQL Editor and run <code>supabase/membership-tracker.sql</code>,
          then refresh this page.
        </div>
      )}
      {error && error !== 'missing-table' && <div className="alert">Could not load the tracker: {error}</div>}

      {loading ? (
        <div className="skeleton-card">
          <div className="skeleton line w80" />
          <div className="skeleton line w60" />
          <div className="skeleton line w40" />
        </div>
      ) : (
        !error && (
          <div className="tracker-board">
            <table className="tracker-table">
              <colgroup>
                <col className="col-id" />
                <col className="col-name" />
                {REQUIREMENT_COLUMNS.map((column) => (
                  <col key={column.key} className="col-check" />
                ))}
                <col className="col-status" />
              </colgroup>
              <thead>
                <tr>
                  <th>Member ID</th>
                  <th>Full name</th>
                  {REQUIREMENT_COLUMNS.map((column) => (
                    <th key={column.key}>{column.short}</th>
                  ))}
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const person = membersById.get(row.member_id)
                  const complete = requirementsComplete(row)
                  const position = TRACKER_ROLES.find((item) => item.value === row.tracker_role)
                  return (
                    <tr key={row.id} className={row.full_name.trim() ? '' : 'is-open'}>
                      <td className="member-code">{memberCode(row.member_no)}</td>
                      <td>
                        <div className="tracker-person">
                          <Avatar src={person?.photo_url} name={row.full_name || null} size={40} />
                          <div>
                            <strong>{row.full_name.trim() || 'No name yet'}</strong>
                            <span className={`tracker-role role-${row.tracker_role}`}>{position?.label || 'Member'}</span>
                          </div>
                        </div>
                      </td>
                      {REQUIREMENT_COLUMNS.map((column) => (
                        <td key={column.key} className="check-cell">
                          <input
                            type="checkbox"
                            className="tracker-check"
                            checked={Boolean(row[column.key])}
                            aria-label={`${column.label} for ${row.full_name || memberCode(row.member_no)}`}
                            onChange={(event) => saveRow(row, { [column.key]: event.target.checked })}
                          />
                        </td>
                      ))}
                      <td>
                        {row.full_name.trim() ? (
                          <span className={`badge ${complete ? 'badge-complete' : 'badge-amber'}`}>
                            {complete ? 'Complete' : 'Pending'}
                          </span>
                        ) : (
                          <span className="badge badge-muted">Open</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {!visible.length && (
                  <tr>
                    <td className="tracker-empty" colSpan={8}>
                      No members match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}

      <p className="muted small">
        Requirements Status turns Complete when Registration Form, 2×2 / Passport Picture, Interview, and Membership Fee
        are all checked. GForms is tracked on its own. The Registration Form box is checked automatically when that
        member submits the registration form.
      </p>

      {!loading && !rows.length && !error && (
        <div className="empty">
          <ClipboardCheck size={36} />
          <p>The tracker is empty. Run supabase/membership-tracker.sql to load the roster.</p>
        </div>
      )}
    </div>
  )
}

function TrackerStat({ label, value, tone }) {
  return (
    <div className={`stat stat-${tone}`}>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}
