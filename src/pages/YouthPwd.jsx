import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, HeartHandshake } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { errorMessage } from '../lib/constants'
import { fetchYouthProfiles } from '../lib/youthApi'
import { downloadCsv, fullName, isPwdYouth, labelOf, PWD_OPTIONS, toCsv } from '../lib/youthProfiling'
import { listLocalYouth } from '../lib/youthOffline'

export default function YouthPwd() {
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

  const pwdYouth = useMemo(() => {
    return rows
      .filter(isPwdYouth)
      .sort(
        (a, b) =>
          String(a.barangay || '').localeCompare(String(b.barangay || '')) ||
          String(a.last_name || '').localeCompare(String(b.last_name || '')),
      )
  }, [rows])

  const grouped = useMemo(() => {
    const map = new Map()
    pwdYouth.forEach((row) => {
      const key = row.barangay || 'Unspecified'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(row)
    })
    return [...map.entries()]
  }, [pwdYouth])

  function exportCsv() {
    const csv = toCsv(pwdYouth, [
      { label: 'Full name', value: (row) => fullName(row) },
      { key: 'barangay', label: 'Barangay' },
      { key: 'age_band', label: 'Age band' },
      { label: 'PWD', value: (row) => labelOf(PWD_OPTIONS, row.pwd) },
      { key: 'pwd_details', label: 'PWD details' },
      { label: 'Contribution areas', value: (row) => (row.contribution_areas || []).join('; ') },
      { key: 'volunteer_interest', label: 'Volunteer interest' },
      { key: 'contact_number', label: 'Contact' },
      { key: 'email', label: 'Email' },
    ])
    downloadCsv('kislap-pwd-youth.csv', csv)
  }

  return (
    <div className="page youth-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Inclusion list</p>
          <h1>PWD youth profiles</h1>
          <p className="muted">
            Youth who voluntarily identified as persons with disability — organized by barangay for program planning.
          </p>
        </div>
        <div className="toolbar">
          <Link to="/youth" className="btn btn-soft">
            <ArrowLeft size={16} /> Back to profiles
          </Link>
          <button type="button" className="btn btn-primary" onClick={exportCsv} disabled={!pwdYouth.length}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </header>

      <section className="youth-kpi-strip">
        <article>
          <strong>{pwdYouth.length}</strong>
          <span>PWD youth</span>
        </article>
        <article>
          <strong>{grouped.length}</strong>
          <span>Barangays represented</span>
        </article>
      </section>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : !grouped.length ? (
        <section className="empty-state">
          <HeartHandshake size={28} />
          <h2>No PWD youth recorded yet</h2>
          <p className="muted">Optional PWD disclosure on the profiling form will appear here when answered Yes.</p>
        </section>
      ) : (
        <div className="youth-barangay-list">
          {grouped.map(([name, people]) => (
            <section key={name} className="youth-barangay-group">
              <header>
                <h2>{name}</h2>
                <span>{people.length} PWD youth</span>
              </header>
              <ul>
                {people.map((row) => (
                  <li key={row.client_id || row.id}>
                    <div>
                      <strong>{fullName(row) || 'Unnamed'}</strong>
                      <small>
                        {row.age_band || '—'}
                        {row.pwd_details ? ` · ${row.pwd_details}` : ''}
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
