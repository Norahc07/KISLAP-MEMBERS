import { useState } from 'react'
import { Plus, ListPlus, Search, Pencil, Trash2, UserPlus } from 'lucide-react'
import Avatar from '../components/Avatar'
import MemberForm from '../components/MemberForm'
import BulkAddForm from '../components/BulkAddForm'
import ConfirmDialog from '../components/ConfirmDialog'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { deleteMember } from '../lib/api'
import { errorMessage } from '../lib/constants'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'assigned', label: 'With role' },
  { key: 'unassigned', label: 'No role' },
]

export default function Members() {
  const { members, rolesByMember, stats, loading, error, reload } = useData()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const q = query.trim().toLowerCase()
  const list = members.filter((m) => {
    const hasRole = rolesByMember.has(m.id)
    if (filter === 'assigned' && !hasRole) return false
    if (filter === 'unassigned' && hasRole) return false
    return !q || m.full_name.toLowerCase().includes(q)
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

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Step 1</p>
          <h1>Members</h1>
          <p className="muted">
            {stats.members} members · {stats.unassigned} without a role
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-soft" onClick={() => setBulkOpen(true)}>
            <ListPlus size={18} /> Bulk add
          </button>
          <button className="btn btn-primary" onClick={() => setEditing({})}>
            <Plus size={18} /> Add member
          </button>
        </div>
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
            return (
              <article key={m.id} className="member-card fade-in">
                <div className="member-actions">
                  <button className="icon-btn" onClick={() => setEditing(m)} aria-label="Edit">
                    <Pencil size={15} />
                  </button>
                  <button className="icon-btn danger" onClick={() => setDeleting(m)} aria-label="Delete">
                    <Trash2 size={15} />
                  </button>
                </div>
                <Avatar src={m.photo_url} name={m.full_name} size={80} className="ring" />
                <h3>{m.full_name}</h3>
                {roles.length ? (
                  <div className="role-tags">
                    {roles.map(({ position, unit }) => (
                      <span key={position.id} className="role-tag" title={unit?.name}>
                        {position.level === 'member' ? `${unit?.name} · Member` : position.title}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="badge badge-muted">No role yet</span>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <div className="empty">
          <UserPlus size={36} />
          <p>{members.length ? 'No members match your search.' : 'Start by adding all the members of the organization.'}</p>
          {!members.length && (
            <button className="btn btn-primary" onClick={() => setEditing({})}>
              <Plus size={18} /> Add first member
            </button>
          )}
        </div>
      )}

      {editing && <MemberForm member={editing.id ? editing : null} onClose={() => setEditing(null)} />}
      {bulkOpen && <BulkAddForm onClose={() => setBulkOpen(false)} />}
      {deleting && (
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
