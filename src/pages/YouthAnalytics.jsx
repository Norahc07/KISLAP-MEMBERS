import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Maximize2, Minimize2 } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useToast } from '../context/ToastContext'
import { errorMessage } from '../lib/constants'
import { fetchYouthBarangayStats, fetchYouthProfiles } from '../lib/youthApi'
import {
  AGE_BANDS,
  EDUCATIONAL_STATUS,
  EMPLOYMENT_STATUS,
  MAUBAN_BARANGAYS,
  MAUBAN_BARANGAY_COORDS,
  SEX_OPTIONS,
  VOLUNTEER_INTEREST,
  countArrayField,
  countBy,
  downloadCsv,
  isPwdYouth,
  isUpcomingSkVoter,
  isWillingMember,
  labelOf,
  toCsv,
} from '../lib/youthProfiling'

const CHART_COLORS = ['#0f766e', '#0ea5e9', '#f59e0b', '#64748b', '#8b5cf6', '#14b8a6', '#ef4444']

function completeOptions(options, counted) {
  const byKey = new Map(counted.map((item) => [item.raw || item.name, item.value]))
  return options.map((option) => {
    const [key, label] = Array.isArray(option) ? option : [option, option]
    return {
      raw: key,
      name: label,
      value: byKey.get(key) || byKey.get(label) || 0,
    }
  })
}

function namedCount(rows, key, options) {
  const counted = countBy(rows, key).map((item) => ({
    raw: item.name,
    name: labelOf(options, item.name === 'Unspecified' ? '' : item.name) || item.name,
    value: item.value,
  }))
  if (!options) return counted
  return completeOptions(options, counted)
}

function RankList({ title, rows, empty = 'No responses yet' }) {
  const sorted = [...rows].sort((a, b) => b.value - a.value || String(a.name).localeCompare(String(b.name)))
  const max = Math.max(1, ...sorted.map((row) => row.value))
  const total = sorted.reduce((sum, row) => sum + row.value, 0)
  return (
    <article className="youth-stat-card">
      <header>
        <h3>{title}</h3>
        <span>{total} responses</span>
      </header>
      {!sorted.length ? (
        <p className="muted">{empty}</p>
      ) : (
        <ol className="youth-rank-list">
          {sorted.map((row, index) => (
            <li key={row.name}>
              <div className="youth-rank-meta">
                <strong>
                  <em>{index + 1}</em>
                  {row.name}
                </strong>
                <span>{row.value}</span>
              </div>
              <div className="youth-rank-track" aria-hidden="true">
                <i style={{ width: `${(row.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </article>
  )
}

function MapInvalidate({ active }) {
  const map = useMap()
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 80)
    return () => clearTimeout(timer)
  }, [map, active])
  return null
}

function FitAllBarangays({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points?.length) return
    const bounds = points.map((point) => [point.lat, point.lng])
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 12 })
  }, [map, points])
  return null
}

export default function YouthAnalytics() {
  const toast = useToast()
  const mapPanelRef = useRef(null)
  const [rows, setRows] = useState([])
  const [barangayStats, setBarangayStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [mapFullscreen, setMapFullscreen] = useState(false)

  useEffect(() => {
    let ignore = false
    async function load() {
      setLoading(true)
      try {
        const [profiles, stats] = await Promise.all([fetchYouthProfiles(), fetchYouthBarangayStats()])
        if (!ignore) {
          setRows((profiles || []).filter((row) => row.status !== 'draft'))
          setBarangayStats(stats || [])
        }
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

  useEffect(() => {
    function onFullscreenChange() {
      setMapFullscreen(Boolean(document.fullscreenElement === mapPanelRef.current))
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const kpis = useMemo(() => {
    const total = rows.length
    const barangays = new Set(rows.map((row) => row.barangay).filter(Boolean)).size
    const volunteerYes = rows.filter((row) => row.volunteer_interest === 'yes').length
    const membership = rows.filter(isWillingMember).length
    const contact = rows.filter((row) => row.contact_opt_in === 'yes').length
    const pwd = rows.filter(isPwdYouth).length
    const upcomingSk = rows.filter(isUpcomingSkVoter).length
    const pct = (n) => (total ? Math.round((n / total) * 100) : 0)
    return {
      total,
      barangays,
      volunteerPct: pct(volunteerYes),
      membershipPct: pct(membership),
      contactPct: pct(contact),
      pwd,
      upcomingSk,
    }
  }, [rows])

  const ageData = useMemo(() => namedCount(rows, 'age_band', AGE_BANDS), [rows])
  const sexData = useMemo(() => namedCount(rows, 'sex', SEX_OPTIONS).filter((row) => row.value > 0), [rows])
  const educationData = useMemo(() => namedCount(rows, 'educational_status', EDUCATIONAL_STATUS).filter((row) => row.value > 0).slice(0, 5), [rows])
  const employmentData = useMemo(() => namedCount(rows, 'employment_status', EMPLOYMENT_STATUS).filter((row) => row.value > 0).slice(0, 5), [rows])
  const skillsData = useMemo(() => countArrayField(rows, 'skills').slice(0, 5), [rows])
  const interestsData = useMemo(() => countArrayField(rows, 'interests').slice(0, 5), [rows])
  const issuesData = useMemo(() => countArrayField(rows, 'community_issues').slice(0, 5), [rows])
  const programsData = useMemo(() => countArrayField(rows, 'kislap_programs').slice(0, 5), [rows])
  const areasData = useMemo(() => countArrayField(rows, 'contribution_areas').slice(0, 5), [rows])
  const volunteerData = useMemo(() => namedCount(rows, 'volunteer_interest', VOLUNTEER_INTEREST), [rows])

  const mapPoints = useMemo(() => {
    const counts = new Map(barangayStats.map((row) => [row.barangay, row]))
    return MAUBAN_BARANGAYS.map((name) => {
      const coords = MAUBAN_BARANGAY_COORDS[name]
      const stats = counts.get(name) || { total: 0, volunteer_yes: 0, membership_apply: 0, contact_opt_in_yes: 0, pwd_yes: 0 }
      return {
        name,
        lng: coords?.[0],
        lat: coords?.[1],
        ...stats,
      }
    }).filter((point) => point.lat != null && point.lng != null)
  }, [barangayStats])

  const mapCoverage = useMemo(() => {
    const covered = mapPoints.filter((point) => Number(point.total) > 0).length
    return { covered, total: mapPoints.length, missing: mapPoints.length - covered }
  }, [mapPoints])

  const maxCount = Math.max(1, ...mapPoints.map((point) => Number(point.total) || 0))

  const barangayRows = useMemo(() => {
    const byName = new Map(barangayStats.map((row) => [row.barangay, row]))
    return MAUBAN_BARANGAYS.map((name) => {
      const row = byName.get(name)
      return {
        barangay: name,
        total: row?.total || 0,
        volunteer_yes: row?.volunteer_yes || 0,
        membership_apply: row?.membership_apply || 0,
        contact_opt_in_yes: row?.contact_opt_in_yes || 0,
        pwd_yes: row?.pwd_yes || 0,
      }
    }).sort((a, b) => b.total - a.total || a.barangay.localeCompare(b.barangay))
  }, [barangayStats])

  function exportSummary() {
    const csv = toCsv(barangayRows, [
      { key: 'barangay', label: 'Barangay' },
      { key: 'total', label: 'Total' },
      { key: 'volunteer_yes', label: 'Volunteer yes' },
      { key: 'membership_apply', label: 'Membership apply' },
      { key: 'contact_opt_in_yes', label: 'Contact opt-in' },
      { key: 'pwd_yes', label: 'PWD yes' },
    ])
    downloadCsv('kislap-youth-analytics-by-barangay.csv', csv)
  }

  async function toggleMapFullscreen() {
    const node = mapPanelRef.current
    if (!node) return
    try {
      if (!document.fullscreenElement) {
        await node.requestFullscreen()
        setMapFullscreen(true)
      } else {
        await document.exitFullscreen()
        setMapFullscreen(false)
      }
    } catch {
      toast.error('Fullscreen is not available on this device.')
    }
  }

  return (
    <div className="page youth-page youth-analytics">
      <header className="page-header">
        <div>
          <p className="eyebrow">Statistical records</p>
          <h1>Youth Profiling Analytics</h1>
          <p className="muted">Organized Mauban Kabataan campaign summary for planning and reporting.</p>
        </div>
        <div className="toolbar youth-quick-nav youth-analytics-actions" aria-label="Analytics actions">
          <Link to="/youth" className="btn btn-soft">
            <ArrowLeft size={16} /> <span className="youth-nav-label">Profiles</span>
            <span className="youth-nav-label-short">Back</span>
          </Link>
          <button type="button" className="btn btn-primary" onClick={exportSummary} disabled={!rows.length && !barangayRows.some((row) => row.total)}>
            <Download size={16} /> <span className="youth-nav-label">Export summary</span>
            <span className="youth-nav-label-short">Export</span>
          </button>
        </div>
      </header>

      {loading ? (
        <p className="muted">Loading analytics...</p>
      ) : (
        <>
          <section className="youth-kpi-strip is-analytics youth-kpi-compact" aria-label="Key indicators">
            <article>
              <strong>{kpis.total}</strong>
              <span>Youth profiled</span>
            </article>
            <article>
              <strong>
                {kpis.barangays}
                <small>/40</small>
              </strong>
              <span>Barangays covered</span>
            </article>
            <article>
              <strong>{kpis.volunteerPct}%</strong>
              <span>Volunteer interest</span>
            </article>
            <article>
              <strong>{kpis.membershipPct}%</strong>
              <span>Membership interest</span>
            </article>
            <article>
              <strong>{kpis.pwd}</strong>
              <span>PWD youth</span>
            </article>
            <article>
              <strong>{kpis.upcomingSk}</strong>
              <span>Upcoming SK (14)</span>
            </article>
          </section>

          <section
            ref={mapPanelRef}
            className={`youth-map-panel youth-map-panel-pro${mapFullscreen ? ' is-fullscreen' : ''}`}
          >
            <div className="youth-map-toolbar">
              <div>
                <h2>Mauban barangay coverage</h2>
                <p className="muted">
                  PhilAtlas-aligned points for all 40 barangays. Bubble size reflects profile count. Covered{' '}
                  {mapCoverage.covered} · Pending {mapCoverage.missing}
                </p>
              </div>
              <button type="button" className="btn btn-soft" onClick={toggleMapFullscreen}>
                {mapFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                {mapFullscreen ? 'Exit full screen' : 'Full screen'}
              </button>
            </div>
            <div className="youth-map-frame">
              <MapContainer
                center={[14.1889, 121.731]}
                zoom={11}
                minZoom={9}
                maxZoom={16}
                scrollWheelZoom={mapFullscreen}
                className="youth-leaflet"
              >
                <MapInvalidate active={mapFullscreen} />
                <FitAllBarangays points={mapPoints} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · PhilAtlas barangay points'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {mapPoints.map((point) => (
                  <CircleMarker
                    key={point.name}
                    center={[point.lat, point.lng]}
                    radius={Number(point.total) ? 7 + (Number(point.total) / maxCount) * 16 : 5}
                    pathOptions={{
                      color: Number(point.total) ? '#0f766e' : '#94a3b8',
                      fillColor: Number(point.total) ? '#14b8a6' : '#cbd5e1',
                      fillOpacity: Number(point.total) ? 0.72 : 0.4,
                      weight: 1.5,
                    }}
                  >
                    <Popup>
                      <strong>{point.name}</strong>
                      <br />
                      Profiles: {point.total || 0}
                      <br />
                      Volunteer yes: {point.volunteer_yes || 0}
                      <br />
                      Membership apply: {point.membership_apply || 0}
                      <br />
                      PWD: {point.pwd_yes || 0}
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
            <div className="youth-map-legend">
              <span>
                <i className="is-covered" /> Covered barangay
              </span>
              <span>
                <i className="is-empty" /> No profiles yet
              </span>
              <span>{mapPoints.length} / 40 mapped</span>
            </div>
          </section>

          <section className="youth-analytics-section">
            <div className="youth-section-heading">
              <h2>Demographics</h2>
              <p className="muted">Age structure and sex distribution of profiled youth.</p>
            </div>
            <div className="youth-analytics-grid demographics">
              <article className="youth-stat-card">
                <header>
                  <h3>Age bands</h3>
                </header>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ageData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={56} />
                    <YAxis allowDecimals={false} width={28} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0f766e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </article>
              <article className="youth-stat-card">
                <header>
                  <h3>Sex</h3>
                </header>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={sexData.length ? sexData : [{ name: 'No data', value: 1 }]} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                      {(sexData.length ? sexData : [{ name: 'No data' }]).map((entry, index) => (
                        <Cell key={entry.name} fill={sexData.length ? CHART_COLORS[index % CHART_COLORS.length] : '#e2e8f0'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </article>
            </div>
          </section>

          <section className="youth-analytics-section">
            <div className="youth-section-heading">
              <h2>Socioeconomic profile</h2>
              <p className="muted">Leading education and employment categories.</p>
            </div>
            <div className="youth-analytics-grid twocol">
              <RankList title="Education status" rows={educationData} />
              <RankList title="Employment status" rows={employmentData} />
            </div>
          </section>

          <section className="youth-analytics-section">
            <div className="youth-section-heading">
              <h2>Engagement</h2>
              <p className="muted">Volunteer interest and leading capabilities.</p>
            </div>
            <div className="youth-analytics-grid engagement">
              <article className="youth-stat-card">
                <header>
                  <h3>Volunteer interest</h3>
                </header>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={volunteerData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} width={28} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </article>
              <RankList title="Top skills" rows={skillsData} />
              <RankList title="Top interests" rows={interestsData} />
            </div>
          </section>

          <section className="youth-analytics-section">
            <div className="youth-section-heading">
              <h2>Program priorities</h2>
              <p className="muted">Community concerns, KISLAP program demand, and preferred roles.</p>
            </div>
            <div className="youth-analytics-grid threecol">
              <RankList title="Community issues" rows={issuesData} />
              <RankList title="KISLAP programs" rows={programsData} />
              <RankList title="Contribution areas" rows={areasData} />
            </div>
          </section>

          <section className="youth-barangay-table youth-stat-card">
            <header className="youth-table-heading">
              <div>
                <h2>Barangay statistical records</h2>
                <p className="muted">Complete 40-barangay register sorted by profile count.</p>
              </div>
            </header>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Barangay</th>
                    <th>Total</th>
                    <th>Volunteer</th>
                    <th>Membership</th>
                    <th>Contact</th>
                    <th>PWD</th>
                  </tr>
                </thead>
                <tbody>
                  {barangayRows.map((row, index) => (
                    <tr key={row.barangay} className={row.total ? '' : 'is-empty-row'}>
                      <td>{index + 1}</td>
                      <td>{row.barangay}</td>
                      <td>{row.total}</td>
                      <td>{row.volunteer_yes}</td>
                      <td>{row.membership_apply}</td>
                      <td>{row.contact_opt_in_yes}</td>
                      <td>{row.pwd_yes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
