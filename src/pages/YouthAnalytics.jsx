import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Presentation, X } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { MapContainer, CircleMarker, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useToast } from '../context/ToastContext'
import { errorMessage } from '../lib/constants'
import { fetchYouthBarangayStats, fetchYouthProfiles } from '../lib/youthApi'
import {
  AGE_BANDS,
  EDUCATIONAL_STATUS,
  EMPLOYMENT_STATUS,
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

const CHART_COLORS = ['#0f766e', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#64748b']

function ChartCard({ title, children, tall }) {
  return (
    <article className={`youth-chart-card${tall ? ' is-tall' : ''}`}>
      <h2>{title}</h2>
      <div className="youth-chart-body">{children}</div>
    </article>
  )
}

function namedCount(rows, key, options) {
  return countBy(rows, key).map((item) => ({
    ...item,
    name: labelOf(options, item.name === 'Unspecified' ? '' : item.name) || item.name,
  }))
}

export default function YouthAnalytics() {
  const toast = useToast()
  const presentRootRef = useRef(null)
  const [rows, setRows] = useState([])
  const [barangayStats, setBarangayStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [present, setPresent] = useState(false)

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
    document.body.classList.toggle('youth-present-mode', present)
    return () => document.body.classList.remove('youth-present-mode')
  }, [present])

  useEffect(() => {
    if (!present) return undefined
    function onKey(event) {
      if (event.key === 'Escape') setPresent(false)
    }
    function onFullscreenChange() {
      if (!document.fullscreenElement) setPresent(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [present])

  async function togglePresent() {
    const next = !present
    setPresent(next)
    const node = presentRootRef.current
    try {
      if (next) {
        if (node?.requestFullscreen) await node.requestFullscreen()
        toast.success('Presentation mode on. Press Esc or Exit present to leave.')
      } else if (document.fullscreenElement) {
        await document.exitFullscreen()
      }
    } catch {
      // Fullscreen can be blocked; CSS present mode still applies.
      if (next) toast.success('Presentation mode on. Press Esc or Exit present to leave.')
    }
  }

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
      pwdPct: pct(pwd),
      upcomingSk,
      upcomingSkPct: pct(upcomingSk),
    }
  }, [rows])

  const ageData = useMemo(() => namedCount(rows, 'age_band', AGE_BANDS), [rows])
  const sexData = useMemo(() => namedCount(rows, 'sex', SEX_OPTIONS), [rows])
  const educationData = useMemo(() => namedCount(rows, 'educational_status', EDUCATIONAL_STATUS).slice(0, 8), [rows])
  const employmentData = useMemo(() => namedCount(rows, 'employment_status', EMPLOYMENT_STATUS).slice(0, 8), [rows])
  const skillsData = useMemo(() => countArrayField(rows, 'skills').slice(0, 10), [rows])
  const interestsData = useMemo(() => countArrayField(rows, 'interests').slice(0, 10), [rows])
  const issuesData = useMemo(() => countArrayField(rows, 'community_issues').slice(0, 10), [rows])
  const programsData = useMemo(() => countArrayField(rows, 'kislap_programs').slice(0, 10), [rows])
  const areasData = useMemo(() => countArrayField(rows, 'contribution_areas').slice(0, 10), [rows])
  const volunteerData = useMemo(() => namedCount(rows, 'volunteer_interest', VOLUNTEER_INTEREST), [rows])

  const mapPoints = useMemo(() => {
    const counts = new Map(barangayStats.map((row) => [row.barangay, row]))
    return Object.entries(MAUBAN_BARANGAY_COORDS).map(([name, [lng, lat]]) => {
      const stats = counts.get(name) || { total: 0, volunteer_yes: 0, membership_apply: 0 }
      return { name, lat, lng, ...stats }
    })
  }, [barangayStats])

  const maxCount = Math.max(1, ...mapPoints.map((point) => Number(point.total) || 0))

  function exportSummary() {
    const csv = toCsv(barangayStats, [
      { key: 'barangay', label: 'Barangay' },
      { key: 'total', label: 'Total' },
      { key: 'volunteer_yes', label: 'Volunteer yes' },
      { key: 'membership_apply', label: 'Membership apply' },
      { key: 'contact_opt_in_yes', label: 'Contact opt-in' },
      { key: 'pwd_yes', label: 'PWD yes' },
    ])
    downloadCsv('kislap-youth-analytics-by-barangay.csv', csv)
  }

  return (
    <div
      ref={presentRootRef}
      className={`page youth-page youth-analytics${present ? ' is-present' : ''}`}
    >
      <header className="page-header">
        <div>
          <p className="eyebrow">Admin presentation</p>
          <h1>Youth Profiling Analytics</h1>
          <p className="muted">Mauban Kabataan campaign insights — no identifiable youth details on the map.</p>
        </div>
        <div className="toolbar youth-quick-nav youth-analytics-actions" aria-label="Analytics actions">
          {!present && (
            <Link to="/youth" className="btn btn-soft">
              <ArrowLeft size={16} /> <span className="youth-nav-label">Profiles</span>
              <span className="youth-nav-label-short">Back</span>
            </Link>
          )}
          <button type="button" className="btn btn-soft" onClick={togglePresent}>
            {present ? <X size={16} /> : <Presentation size={16} />}
            <span className="youth-nav-label">{present ? 'Exit present' : 'Present'}</span>
            <span className="youth-nav-label-short">{present ? 'Exit' : 'Present'}</span>
          </button>
          <button type="button" className="btn btn-primary" onClick={exportSummary} disabled={!barangayStats.length}>
            <Download size={16} /> <span className="youth-nav-label">Export summary</span>
            <span className="youth-nav-label-short">Export</span>
          </button>
        </div>
      </header>
      {present && (
        <p className="youth-present-hint muted">Presentation mode — Esc to exit</p>
      )}

      {loading ? (
        <p className="muted">Loading analytics…</p>
      ) : (
        <>
          <section className="youth-kpi-strip is-analytics">
            <article>
              <strong>{kpis.total}</strong>
              <span>Youth profiled</span>
            </article>
            <article>
              <strong>{kpis.barangays}</strong>
              <span>Barangays covered</span>
            </article>
            <article>
              <strong>{kpis.volunteerPct}%</strong>
              <span>Volunteer interest</span>
            </article>
            <article>
              <strong>{kpis.membershipPct}%</strong>
              <span>Membership / orientation</span>
            </article>
            <article>
              <strong>{kpis.contactPct}%</strong>
              <span>Contact opt-in</span>
            </article>
            <article>
              <strong>{kpis.pwd}</strong>
              <span>PWD youth ({kpis.pwdPct}%)</span>
            </article>
            <article>
              <strong>{kpis.upcomingSk}</strong>
              <span>Upcoming SK age 14 ({kpis.upcomingSkPct}%)</span>
            </article>
          </section>

          <section className="youth-map-panel">
            <div className="youth-map-copy">
              <h2>Mauban barangay coverage</h2>
              <p className="muted">Bubble size reflects number of submitted youth profiles per barangay.</p>
            </div>
            <div className="youth-map-frame">
              <MapContainer center={[14.1911, 121.7308]} zoom={11} scrollWheelZoom={false} className="youth-leaflet">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {mapPoints.map((point) => (
                  <CircleMarker
                    key={point.name}
                    center={[point.lat, point.lng]}
                    radius={6 + (Number(point.total) / maxCount) * 18}
                    pathOptions={{
                      color: '#0f766e',
                      fillColor: '#14b8a6',
                      fillOpacity: Number(point.total) ? 0.65 : 0.15,
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
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </section>

          <section className="youth-chart-grid">
            <ChartCard title="Age bands">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={ageData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} width={32} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0f766e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Sex">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={sexData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                    {sexData.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Volunteer interest">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={volunteerData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} width={32} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Education status" tall>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={educationData} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Employment" tall>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={employmentData} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top skills" tall>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={skillsData} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#14b8a6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top interests" tall>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={interestsData} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Community issues" tall>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={issuesData} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#ef4444" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="KISLAP program demand" tall>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={programsData} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0f766e" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Contribution areas (roles)" tall>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={areasData} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#64748b" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          <section className="youth-barangay-table">
            <h2>Barangay breakdown</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Barangay</th>
                    <th>Total</th>
                    <th>Volunteer yes</th>
                    <th>Membership apply</th>
                    <th>Contact opt-in</th>
                    <th>PWD</th>
                  </tr>
                </thead>
                <tbody>
                  {(barangayStats.length
                    ? barangayStats
                    : [{ barangay: '—', total: 0, volunteer_yes: 0, membership_apply: 0, contact_opt_in_yes: 0, pwd_yes: 0 }]
                  ).map((row) => (
                      <tr key={row.barangay}>
                        <td>{row.barangay}</td>
                        <td>{row.total}</td>
                        <td>{row.volunteer_yes}</td>
                        <td>{row.membership_apply}</td>
                        <td>{row.contact_opt_in_yes}</td>
                        <td>{row.pwd_yes || 0}</td>
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
