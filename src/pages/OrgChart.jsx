import { useState } from 'react'
import { Users, UserRound, GraduationCap, ClipboardList, Search } from 'lucide-react'
import Avatar from '../components/Avatar'
import Logo from '../components/Logo'
import { useData } from '../context/DataContext'
import { LEVELS } from '../lib/constants'

export default function OrgChart() {
  const { units, positionsByUnit, membersById, roster, stats, loading, error } = useData()
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const matches = (p) => {
    if (!q) return true
    const name = membersById.get(p.member_id)?.full_name ?? ''
    return name.toLowerCase().includes(q) || p.title.toLowerCase().includes(q)
  }

  const executive = units.filter((u) => u.kind === 'executive')
  const committees = units
    .filter((u) => u.kind === 'committee')
    .filter((u) => !q || u.name.toLowerCase().includes(q) || (positionsByUnit.get(u.id) ?? []).some(matches))

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-content">
          <Logo size={76} />
          <div>
            <p className="eyebrow">Organizational Structure</p>
            <h1>KISLAP Youth Volunteers</h1>
            <p className="hero-sub">Officers, directors and members working together for the community.</p>
          </div>
        </div>
      </section>

      <section className="stats">
        <Stat icon={Users} label="Members" value={stats.members} tone="blue" />
        <Stat icon={GraduationCap} label="Advisers" value={roster.advisers} tone="violet" />
        <Stat icon={UserRound} label="No member ID" value={stats.withoutId} tone="amber" />
        <Stat icon={ClipboardList} label="Forms submitted" value={stats.submitted} tone="green" />
      </section>

      <p className="roster-note">
        Member count follows the tracker and stays linked to users and submitted forms.
        Advisers have their own accounts and are not counted as members.
      </p>
      {roster.withoutIdPeople.length > 0 && (
        <div className="roster-hold">
          {roster.withoutIdPeople.map((person) => (
            <span key={person.id} className="crew-chip">
              {person.name}
            </span>
          ))}
        </div>
      )}

      <div className="toolbar">
        <div className="search">
          <Search size={17} />
          <input placeholder="Search name, role or committee…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {error && <div className="alert">Could not load data: {error}</div>}

      {loading ? (
        <SkeletonGrid />
      ) : (
        <>
          {executive.map((unit) => {
            const list = (positionsByUnit.get(unit.id) ?? []).filter(matches)
            if (!list.length) return null
            const advisers = list.filter((p) => p.level === 'adviser')
            const officers = list.filter((p) => p.level !== 'adviser')
            return (
              <section key={unit.id} className="section fade-in">
                <h2 className="section-title">{unit.name}</h2>
                {advisers.length > 0 && (
                  <div className={`adviser-row ${officers.length ? 'has-connector' : ''}`}>
                    {advisers.map((p) => (
                      <OfficerCard key={p.id} position={p} member={membersById.get(p.member_id)} variant="adviser" />
                    ))}
                  </div>
                )}
                {officers.length > 0 && (
                  <div className="officer-grid">
                    {officers.map((p, i) => (
                      <OfficerCard
                        key={p.id}
                        position={p}
                        member={membersById.get(p.member_id)}
                        variant={i === 0 && !q ? 'featured' : ''}
                      />
                    ))}
                  </div>
                )}
              </section>
            )
          })}

          {committees.length > 0 && (
            <section className="section fade-in">
              <h2 className="section-title">Standing Directors &amp; Committees</h2>
              <div className="committee-grid">
                {committees.map((unit, i) => (
                  <CommitteeCard
                    key={unit.id}
                    index={i + 1}
                    unit={unit}
                    positions={positionsByUnit.get(unit.id) ?? []}
                    membersById={membersById}
                  />
                ))}
              </div>
            </section>
          )}

          {!units.length && !error && (
            <div className="empty">
              <p>No data yet. Sign in as admin and run the seed script to load the roster.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className={`stat stat-${tone}`}>
      <div className="stat-icon">
        <Icon size={20} />
      </div>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}

function OfficerCard({ position, member, variant = '' }) {
  return (
    <article className={`officer-card ${variant} ${member ? '' : 'is-vacant'}`}>
      <Avatar src={member?.photo_url} name={member?.full_name} size={variant ? 104 : 84} className="ring" />
      <h3>{member?.full_name ?? 'Vacant'}</h3>
      <p>{position.title}</p>
    </article>
  )
}

function CommitteeCard({ index, unit, positions, membersById }) {
  const leads = positions.filter((p) => p.level !== 'member')
  const crew = positions.filter((p) => p.level === 'member')
  const vacant = positions.filter((p) => !p.member_id).length

  return (
    <article className="committee-card">
      <header>
        <span className="committee-index">{String(index).padStart(2, '0')}</span>
        <h3>{unit.name}</h3>
        {vacant > 0 && <span className="badge badge-amber">{vacant} vacant</span>}
      </header>

      <ul className="lead-list">
        {leads.map((p) => {
          const m = membersById.get(p.member_id)
          return (
            <li key={p.id} className={m ? '' : 'is-vacant'}>
              <Avatar src={m?.photo_url} name={m?.full_name} size={40} />
              <div>
                <strong>{m?.full_name ?? 'Vacant'}</strong>
                <span>{p.level === 'member' ? p.title : LEVELS[p.level].label}</span>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="crew">
        <span className="crew-label">Members</span>
        {crew.filter((p) => p.member_id).length ? (
          <div className="crew-list">
            {crew
              .filter((p) => p.member_id)
              .map((p) => {
                const m = membersById.get(p.member_id)
                return (
                  <span key={p.id} className="crew-chip" title={m?.full_name}>
                    <Avatar src={m?.photo_url} name={m?.full_name} size={24} />
                    {m?.full_name}
                  </span>
                )
              })}
          </div>
        ) : (
          <span className="muted small">No members yet</span>
        )}
      </div>
    </article>
  )
}

function SkeletonGrid() {
  return (
    <div className="committee-grid">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton line w60" />
          <div className="skeleton line w80" />
          <div className="skeleton line w40" />
        </div>
      ))}
    </div>
  )
}
