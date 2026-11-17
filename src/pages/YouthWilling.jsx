import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { errorMessage } from '../lib/constants'
import { fetchYouthProfiles } from '../lib/youthApi'
import {
  downloadCsv,
  fullName,
  isWillingMember,
  membershipInterestLabel,
  toCsv,
  WILLING_MEMBERSHIP_KEYS,
} from '../lib/youthProfiling'
import { listLocalYouth } from '../lib/youthOffline'

export default function YouthWilling() {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [includeOrientation, setIncludeOrientation] = useState(true)

  useEffect(() => {
    let ignore = false
    async function load() {
      setLoading(true)
      try {
        let remote = []
        try {
          remote = await fetchYouthProfiles()
        } catch {
          remote = []
        }
        const local = await listLocalYouth()
        const byClient = new Map()
        remote.forEach((row) => byClient.set(row.client_id, row))
        local.forEach((row) => {
          if (!byClient.has(row.client_id) || row.sync_status === 'pending') byClient.set(row.client_id, row)
        })
        if (!ignore) setRows([...byClient.values()])
      } catch (error) {
        if (!ignore) toast.error(errorMessage(error))
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => {
      ignore = true
    }
  }, [])

  const willing = useMemo(() => {
    return rows
      .filter((row) => {
        if (includeOrientation) return isWillingMember(row)
        return row.membership_interest === 'apply'
      })
      .sort(
        (a, b) =>
          String(a.barangay || '').localeCompare(String(b.barangay || '')) ||
          String(a.last_name || '').localeCompare(String(b.last_name || '')),
      )
  }, [rows, includeOrientation])

  function exportCsv() {
    const csv = toCsv(willing, [
      { label: 'Full name', value: (row) => fullName(row) },
      { key: 'barangay', label: 'Barangay' },
      { label: 'Membership interest', value: (row) => membershipInterestLabel(row.membership_interest) },
      { label: 'Contribution areas', value: (row) => (row.contribution_areas || []).join('; ') },
      { key: 'volunteer_interest', label: 'Volunteer interest' },
      { key: 'contact_opt_in', label: 'Contact opt-in' },
      { key: 'preferred_contact_method', label: 'Contact method' },
      { key: 'preferred_contact_details', label: 'Contact details' },
      { key: 'contact_number', label: 'Phone' },
      { key: 'email', label: 'Email' },
    ])
    downloadCsv('kislap-willing-youth.csv', csv)
  }

  return (
    <div className="page youth-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Recruitment pipeline</p>
          <h1>Willing to join KISLAP</h1>
          <p className="muted">
            Youth who expressed membership or orientation interest. These are not official members yet.
          </p>
        </div>
        <div className="toolbar">
          <Link to="/youth" className="btn btn-soft">
            <ArrowLeft size={16} /> Back to profiles
          </Link>
          <button type="button" className="btn btn-primary" onClick={exportCsv} disabled={!willing.length}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </header>

      <label className="check-row youth-willing-toggle">
        <input
          type="checkbox"
          checked={includeOrientation}
          onChange={(event) => setIncludeOrientation(event.target.checked)}
        />
        <span>Include “attend an orientation first” ({WILLING_MEMBERSHIP_KEYS.join(', ')})</span>
      </label>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : !willing.length ? (
        <section className="empty-state">
          <h2>No willing youth yet</h2>
          <p className="muted">When respondents choose membership or orientation interest, they appear here.</p>
        </section>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Barangay</th>
                <th>Interest</th>
                <th>Roles / areas</th>
                <th>Contact</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {willing.map((row) => (
                <tr key={row.client_id || row.id}>
                  <td>
                    <strong>{fullName(row)}</strong>
                    {row.nickname ? <div className="muted">“{row.nickname}”</div> : null}
                  </td>
                  <td>{row.barangay || '—'}</td>
                  <td>{membershipInterestLabel(row.membership_interest)}</td>
                  <td>{(row.contribution_areas || []).join(', ') || '—'}</td>
                  <td>
                    {row.contact_opt_in === 'yes' ? (
                      <>
                        <div>{row.preferred_contact_method || '—'}</div>
                        <div className="muted">{row.preferred_contact_details || row.contact_number || row.email || '—'}</div>
                      </>
                    ) : (
                      <span className="muted">No contact opt-in</span>
                    )}
                  </td>
                  <td>
                    <Link className="btn btn-soft" to={`/youth/${row.id || row.client_id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
