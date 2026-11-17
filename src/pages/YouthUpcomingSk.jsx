import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Vote } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { errorMessage } from '../lib/constants'
import { fetchYouthProfiles } from '../lib/youthApi'
import {
  AGE_BANDS,
  downloadCsv,
  fullName,
  isUpcomingSkVoter,
  labelOf,
  toCsv,
} from '../lib/youthProfiling'
import { listLocalYouth } from '../lib/youthOffline'

export default function YouthUpcomingSk() {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

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

  const upcoming = useMemo(() => {
    return rows
      .filter(isUpcomingSkVoter)
      .sort(
        (a, b) =>
          String(a.barangay || '').localeCompare(String(b.barangay || '')) ||
          String(a.last_name || '').localeCompare(String(b.last_name || '')),
      )
  }, [rows])

  const grouped = useMemo(() => {
    const map = new Map()
    upcoming.forEach((row) => {
      const key = row.barangay || 'Unspecified'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(row)
    })
    return [...map.entries()]
  }, [upcoming])

  function exportCsv() {
    const csv = toCsv(upcoming, [
      { label: 'Full name', value: (row) => fullName(row) },
      { key: 'barangay', label: 'Barangay' },
      { label: 'Age band', value: (row) => labelOf(AGE_BANDS, row.age_band) },
      { key: 'date_of_birth', label: 'Date of birth' },
      { label: 'Contribution areas', value: (row) => (row.contribution_areas || []).join('; ') },
      { key: 'volunteer_interest', label: 'Volunteer interest' },
      { key: 'contact_number', label: 'Contact' },
      { key: 'email', label: 'Email' },
    ])
    downloadCsv('kislap-upcoming-sk-voters-age-14.csv', csv)
  }

  return (
    <div className="page youth-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Barangay SK pipeline</p>
          <h1>Upcoming SK voters (age 14)</h1>
          <p className="muted">
            Youth who are 14 now and becoming 15 — the starting age for barangay SK voter eligibility.
          </p>
        </div>
        <div className="toolbar">
          <Link to="/youth" className="btn btn-soft">
            <ArrowLeft size={16} /> Back to profiles
          </Link>
          <button type="button" className="btn btn-primary" onClick={exportCsv} disabled={!upcoming.length}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </header>

      <section className="youth-kpi-strip">
        <article>
          <strong>{upcoming.length}</strong>
          <span>Age 14 youth</span>
        </article>
        <article>
          <strong>{grouped.length}</strong>
          <span>Barangays represented</span>
        </article>
      </section>

      {loading ? (
        <p className="muted">Loading...</p>
      ) : !grouped.length ? (
        <section className="empty-state">
          <Vote size={28} />
          <h2>No age-14 profiles yet</h2>
          <p className="muted">
            Collect profiles with age band &quot;14 (upcoming SK voter)&quot; to track youth approaching SK eligibility.
          </p>
        </section>
      ) : (
        <div className="youth-barangay-list">
          {grouped.map(([name, people]) => (
            <section key={name} className="youth-barangay-group">
              <header>
                <h2>{name}</h2>
                <span>{people.length} upcoming SK</span>
              </header>
              <ul>
                {people.map((row) => (
                  <li key={row.client_id || row.id}>
                    <div>
                      <strong>{fullName(row) || 'Unnamed'}</strong>
                      <small>
                        {labelOf(AGE_BANDS, row.age_band)}
                        {row.date_of_birth ? ` · DOB ${row.date_of_birth}` : ''}
                        {row.nickname ? ` · "${row.nickname}"` : ''}
                      </small>
                      <small className="youth-roles">
                        {(row.contribution_areas || []).join(' · ') || 'No contribution area yet'}
                      </small>
                    </div>
                    <div className="youth-row-actions">
                      <Link className="btn btn-soft" to={`/youth/${row.id || row.client_id}`}>
                        Open
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
