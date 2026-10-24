import { useEffect, useState } from 'react'
import { Plus, ListPlus, Search, Pencil, Trash2, UserPlus, ArrowLeft } from 'lucide-react'
import Avatar from '../components/Avatar'
import MemberForm from '../components/MemberForm'
import BulkAddForm from '../components/BulkAddForm'
import ConfirmDialog from '../components/ConfirmDialog'
import RegistrationPrint from '../components/RegistrationPrint'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { deleteMember } from '../lib/api'
import { errorMessage } from '../lib/constants'
import { fromRow } from '../lib/registration'
import { memberCode } from '../lib/tracker'
import { supabase } from '../supabaseClient'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'assigned', label: 'With role' },
  { key: 'unassigned', label: 'No role' },
]

export default function Members() {
  const { isAdviser } = useAuth()
  const { members, rolesByMember, roster, stats, tracker, loading, error, reload } = useData()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [approvedByNo, setApprovedByNo] = useState(() => new Map())
  const [viewing, setViewing] = useState(null)

  useEffect(() => {
    if (!isAdviser) return undefined
    let ignore = false
    supabase
      .from('registrations')
      .select('*')
      .eq('application_status', 'approved')
      .then(({ data }) => {
        if (ignore) return
        setApprovedByNo(new Map((data || []).map((row) => [row.member_no, row])))
      })
    return () => {
      ignore = true
    }
  }, [isAdviser])

  const q = query.trim().toLowerCase()
  const numberByMember = new Map((tracker || []).filter((row) => row.member_id).map((row) => [row.member_id, row.member_no]))
  const list = members
    .filter((m) => {
      const hasRole = rolesByMember.has(m.id)
      if (filter === 'assigned' && !hasRole) return false
      if (filter === 'unassigned' && hasRole) return false
      return !q || m.full_name.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      const an = numberByMember.get(a.id)
      const bn = numberByMember.get(b.id)
      if (an && bn) return an - bn
      if (an) return -1
      if (bn) return 1
      return a.full_name.localeCompare(b.full_name)
    })

  async function handleDelete() {
    try {
      await deleteMember(deleting)
      await reload()
      toast.success('Member removed')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  if (viewing) {
    return (
      <div className="page page-wide">
        <div className="page-header">
          <div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setViewing(null)}>
              <ArrowLeft size={16} /> Members
            </button>
            <h1>{viewing.member.full_name}</h1>
            <p className="muted">{memberCode(viewing.registration.member_no)} · Approved registration</p>
          </div>
        </div>
        <RegistrationPrint form={fromRow(viewing.registration)} preview />
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{isAdviser ? 'Directory' : 'Step 1'}</p>
          <h1>Members</h1>
          <p className="muted">
            {isAdviser
              ? 'Every member is listed here. Open a member to view the registration form after it is submitted and approved.'
              : `${stats.members} members · ${roster.withId} with a membership ID${roster.withoutId ? ` · ${roster.withoutId} without one` : ''}. The list follows membership ID order.`}
          </p>
        </div>
        {!isAdviser && (
          <div className="header-actions">
            <button className="btn btn-soft" onClick={() => setBulkOpen(true)}>
              <ListPlus size={18} /> Bulk add
            </button>
            <button className="btn btn-primary" onClick={() => setEditing({})}>
              <Plus size={18} /> Add member
            </button>
          </div>
        )}
      </header>

      <div className="toolbar">
        <div className="search">
          <Search size={17} />
          <input placeholder="Search members…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="segmented">
          {FILTERS.map((f) => (
            <button key={f.key} className={filter === f.key ? 'active' : ''} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert">Could not load data: {error}</div>}

      {loading ? (
        <div className="member-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-card tall">
              <div className="skeleton circle" />
              <div className="skeleton line w80" />
              <div className="skeleton line w60" />
            </div>
          ))}
        </div>
      ) : list.length ? (
        <div className="member-grid">
          {list.map((m) => {
            const roles = rolesByMember.get(m.id) ?? []
            const code = numberByMember.get(m.id)
            const approved = code ? approvedByNo.get(code) : null
            const adviserOnly = roles.length > 0 && roles.every(({ position }) => position.level === 'adviser')
            return (
              <article
                key={m.id}
                className={`member-card fade-in ${approved ? 'is-openable' : ''}`}
                onClick={approved ? () => setViewing({ member: m, registration: approved }) : undefined}
                onKeyDown={approved ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setViewing({ member: m, registration: approved })
                  }
                } : undefined}
                role={approved ? 'button' : undefined}
                tabIndex={approved ? 0 : undefined}
              >
                {!isAdviser && (
                  <div className="member-actions">
                    <button className="icon-btn" onClick={() => setEditing(m)} aria-label="Edit">
                      <Pencil size={15} />
                    </button>
                    <button className="icon-btn danger" onClick={() => setDeleting(m)} aria-label="Delete">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
                <Avatar src={m.photo_url} name={m.full_name} size={80} className="ring" />
                <h3>{m.full_name}</h3>
                {code ? (
                  <span className="badge">{memberCode(code)}</span>
                ) : adviserOnly ? (
                  <span className="badge">Adviser</span>
                ) : (
                  <span className="badge badge-muted">No membership ID</span>
                )}
                {approved && <span className="badge badge-approved">View form</span>}
                {roles.length ? (
                  <div className="role-tags">
                    {roles.map(({ position, unit }) => (
                      <span key={position.id} className="role-tag" title={unit?.name}>
                        {position.level === 'member' ? `${unit?.name} · Member` : position.title}
                      </span>
                    ))}
                  </div>
                ) : !isAdviser ? (
                  <span className="badge badge-muted">No role yet</span>
                ) : null}
              </article>
            )
          })}
        </div>
      ) : (
        <div className="empty">
          <UserPlus size={36} />
          <p>{members.length ? 'No members match your search.' : isAdviser ? 'No members yet.' : 'Start by adding all the members of the organization.'}</p>
          {!members.length && !isAdviser && (
            <button className="btn btn-primary" onClick={() => setEditing({})}>
              <Plus size={18} /> Add first member
            </button>
          )}
        </div>
      )}

      {editing && !isAdviser && <MemberForm member={editing.id ? editing : null} onClose={() => setEditing(null)} />}
      {bulkOpen && !isAdviser && <BulkAddForm onClose={() => setBulkOpen(false)} />}
      {deleting && !isAdviser && (
        <ConfirmDialog
          title="Remove member?"
          message={`${deleting.full_name} will be removed and any position they hold will become vacant.`}
          confirmLabel="Remove"
          onConfirm={handleDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
