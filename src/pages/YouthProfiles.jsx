import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CloudOff, Download, HeartHandshake, MapPinned, Plus, RefreshCw, Search, Users } from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { errorMessage } from '../lib/constants'
import { deleteYouthProfile, fetchYouthProfiles } from '../lib/youthApi'
import {
  CONTRIBUTION_AREAS,
  MAUBAN_BARANGAYS,
  VOLUNTEER_INTEREST,
  downloadCsv,
  fullName,
  isPwdYouth,
  isWillingMember,
  labelOf,
  toCsv,
} from '../lib/youthProfiling'
import { isOnline, listLocalYouth, listPendingYouth, removeLocalYouth, subscribeOnline, syncPendingYouth } from '../lib/youthOffline'

function mergeProfiles(remote, local) {
  const byClient = new Map()
  remote.forEach((row) => {
    byClient.set(row.client_id, { ...row, sync_status: 'synced', source: 'remote' })
  })
  local.forEach((row) => {
    const existing = byClient.get(row.client_id)
    if (!existing || row.sync_status === 'pending' || row.sync_status === 'error') {
      byClient.set(row.client_id, { ...row, source: 'local' })
    }
  })
  return [...byClient.values()].sort(
    (a, b) =>
      String(a.barangay || '').localeCompare(String(b.barangay || '')) ||
      String(a.last_name || '').localeCompare(String(b.last_name || '')) ||
      String(a.first_name || '').localeCompare(String(b.first_name || '')),
  )
}

export default function YouthProfiles() {
  const { profile, canDo, isAdmin } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [online, setOnline] = useState(isOnline())
  const [query, setQuery] = useState('')
  const [barangay, setBarangay] = useState('')
  const [volunteer, setVolunteer] = useState('')
  const [contribution, setContribution] = useState('')
  const [pwdOnly, setPwdOnly] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)

  const canCreate = canDo('youth_profiling_create')
  const canUpdate = canDo('youth_profiling_update')
  const canDelete = canDo('youth_profiling_delete')

  async function reload() {
    setLoading(true)
    try {
      const local = await listLocalYouth()
      let remote = []
      if (online) {
        try {
          remote = await fetchYouthProfiles()
        } catch (error) {
          toast.error(errorMessage(error))
        }
      }
      setRows(mergeProfiles(remote, local))
      setPendingCount((await listPendingYouth()).length)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => subscribeOnline(setOnline), [])

  useEffect(() => {
    reload()
  }, [online])

  useEffect(() => {
    if (!online || pendingCount === 0) return undefined
    let ignore = false
    syncPendingYouth({ collectedBy: profile?.member_no || null }).then((result) => {
      if (ignore) return
      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} offline profile${result.synced === 1 ? '' : 's'}.`)
        reload()
      }
    })
    return () => {
      ignore = true
    }
  }, [online])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (barangay && row.barangay !== barangay) return false
      if (volunteer && row.volunteer_interest !== volunteer) return false
      if (contribution && !(row.contribution_areas || []).includes(contribution)) return false
      if (pwdOnly && !isPwdYouth(row)) return false
      if (!q) return true
      const hay = `${fullName(row)} ${row.nickname || ''} ${row.barangay || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [rows, query, barangay, volunteer, contribution, pwdOnly])

  const grouped = useMemo(() => {
    const map = new Map()
    filtered.forEach((row) => {
      const key = row.barangay || 'Unspecified'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(row)
    })
    return [...map.entries()]
  }, [filtered])

  const covered = useMemo(() => new Set(rows.map((row) => row.barangay).filter(Boolean)).size, [rows])

  async function handleSync() {
    setSyncing(true)
    try {
      const result = await syncPendingYouth({ collectedBy: profile?.member_no || null })
      if (result.synced) toast.success(`Synced ${result.synced} profile${result.synced === 1 ? '' : 's'}.`)
      if (result.failed) toast.error(`${result.failed} profile${result.failed === 1 ? '' : 's'} failed to sync.`)
      if (!result.synced && !result.failed) toast.success('Nothing pending to sync.')
      await reload()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSyncing(false)
    }
  }

  function exportCsv() {
    const csv = toCsv(filtered, [
      { label: 'Full name', value: (row) => fullName(row) },
      { key: 'nickname', label: 'Nickname' },
      { key: 'barangay', label: 'Barangay' },
      { key: 'age_band', label: 'Age band' },
      { key: 'sex', label: 'Sex' },
      { key: 'volunteer_interest', label: 'Volunteer interest' },
      { key: 'membership_interest', label: 'Membership interest' },
      { label: 'Contribution areas', value: (row) => (row.contribution_areas || []).join('; ') },
      { key: 'contact_number', label: 'Contact' },
      { key: 'sync_status', label: 'Sync' },
    ])
    downloadCsv('kislap-youth-profiles.csv', csv)
  }

  async function confirmDelete() {
    if (!removeTarget) return
    try {
      if (removeTarget.id && online) await deleteYouthProfile(removeTarget.id)
      await removeLocalYouth(removeTarget.client_id)
      toast.success('Profile deleted.')
      setRemoveTarget(null)
      await reload()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div className="page youth-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">KISLAP Kabataan</p>
          <h1>Youth Profiling</h1>
          <p className="muted">
            Mauban youth collection by barangay — separate from official KISLAP members.
          </p>
        </div>
        <div className="toolbar">
          {canCreate && (
            <Link to="/youth/new" className="btn btn-primary">
              <Plus size={16} /> Collect profile
            </Link>
          )}
          <Link to="/youth/willing" className="btn btn-soft">
            <Users size={16} /> Willing to join
          </Link>
          <Link to="/youth/pwd" className="btn btn-soft">
            <HeartHandshake size={16} /> PWD youth
          </Link>
          {isAdmin && (
            <Link to="/youth/analytics" className="btn btn-soft">
              <MapPinned size={16} /> Analytics
            </Link>
          )}
        </div>
      </header>

      {!online && (
        <div className="alert youth-offline-banner">
          <CloudOff size={16} /> You are offline. New forms save locally and will sync when connected.
        </div>
      )}

      <section className="youth-kpi-strip">
        <article>
          <strong>{rows.length}</strong>
          <span>Profiles</span>
        </article>
        <article>
          <strong>{covered}</strong>
          <span>Barangays covered</span>
        </article>
        <article>
          <strong>{rows.filter(isWillingMember).length}</strong>
          <span>Willing / orientation</span>
        </article>
        <article>
          <strong>{rows.filter(isPwdYouth).length}</strong>
          <span>PWD youth</span>
        </article>
        <article>
          <strong>{pendingCount}</strong>
          <span>Pending sync</span>
        </article>
      </section>

      <div className="toolbar youth-filters">
        <label className="field youth-search">
          <Search size={16} />
          <input
            className="input"
            placeholder="Search name or barangay"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select className="input" value={barangay} onChange={(event) => setBarangay(event.target.value)}>
          <option value="">All barangays</option>
          {MAUBAN_BARANGAYS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select className="input" value={volunteer} onChange={(event) => setVolunteer(event.target.value)}>
          <option value="">All volunteer interest</option>
          {VOLUNTEER_INTEREST.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select className="input" value={contribution} onChange={(event) => setContribution(event.target.value)}>
          <option value="">All contribution areas</option>
          {CONTRIBUTION_AREAS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <label className="check-row youth-willing-toggle">
          <input type="checkbox" checked={pwdOnly} onChange={(event) => setPwdOnly(event.target.checked)} />
          <span>PWD only</span>
        </label>
        <button type="button" className="btn btn-soft" onClick={handleSync} disabled={!online || syncing}>
          <RefreshCw size={16} /> {syncing ? 'Syncing…' : 'Sync now'}
        </button>
        <button type="button" className="btn btn-soft" onClick={exportCsv} disabled={!filtered.length}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading profiles…</p>
      ) : !grouped.length ? (
        <section className="empty-state">
          <h2>No youth profiles yet</h2>
          <p className="muted">Start barangay data gathering with the collection form.</p>
          {canCreate && (
            <Link to="/youth/new" className="btn btn-primary">
              <Plus size={16} /> Collect first profile
            </Link>
          )}
        </section>
      ) : (
        <div className="youth-barangay-list">
          {grouped.map(([name, people]) => (
            <section key={name} className="youth-barangay-group">
              <header>
                <h2>{name}</h2>
                <span>
                  {people.length} youth ·{' '}
                  {people.filter((row) => (row.contribution_areas || []).length).length} with roles
                </span>
              </header>
              <ul>
                {people.map((row) => (
                  <li key={row.client_id || row.id}>
                    <div>
                      <strong>{fullName(row) || 'Unnamed'}</strong>
                      <small>
                        {row.nickname ? `"${row.nickname}" · ` : ''}
                        {row.age_band || '—'} · {labelOf(VOLUNTEER_INTEREST, row.volunteer_interest)}
                        {isWillingMember(row) ? ' · Willing to join' : ''}
                        {isPwdYouth(row) ? ' · PWD' : ''}
                      </small>
                      <small className="youth-roles">
                        {(row.contribution_areas || []).join(' · ') || 'No contribution area yet'}
                      </small>
                    </div>
                    <div className="youth-row-actions">
                      <span className={`youth-sync-badge is-${row.sync_status || 'synced'}`}>
                        {row.sync_status === 'pending'
                          ? 'Pending'
                          : row.sync_status === 'error'
                            ? 'Sync error'
                            : 'Synced'}
                      </span>
                      {(canUpdate || canCreate) && (
                        <Link className="btn btn-soft" to={`/youth/${row.id || row.client_id}`}>
                          Open
                        </Link>
                      )}
                      {canDelete && (
                        <button type="button" className="btn btn-ghost" onClick={() => setRemoveTarget(row)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {removeTarget && (
        <ConfirmDialog
          title="Delete youth profile?"
          message={`Remove ${fullName(removeTarget) || 'this profile'} from youth profiling?`}
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onClose={() => setRemoveTarget(null)}
        />
      )}
    </div>
  )
}
