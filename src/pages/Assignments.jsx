import { useState } from 'react'
import { Plus, Pencil, Trash2, UserMinus, Search, FolderPlus, Crown, Users } from 'lucide-react'
import Avatar from '../components/Avatar'
import MemberOptions from '../components/MemberOptions'
import PositionForm from '../components/PositionForm'
import UnitForm from '../components/UnitForm'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { assignMember, deletePosition, deleteUnit } from '../lib/api'
import { LEVELS, errorMessage } from '../lib/constants'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'vacant', label: 'Vacant' },
  { key: 'filled', label: 'Filled' },
]

export default function Assignments() {
  const { isAdviser } = useAuth()
  const { units, positionsByUnit, membersById, stats, loading, error, reload } = useData()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [positionForm, setPositionForm] = useState(null)
  const [unitForm, setUnitForm] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const q = query.trim().toLowerCase()
  const visible = (p, unit) => {
    if (filter === 'vacant' && p.member_id) return false
    if (filter === 'filled' && !p.member_id) return false
    if (!q) return true
    const name = membersById.get(p.member_id)?.full_name ?? ''
    return [name, p.title, unit.name].some((s) => s.toLowerCase().includes(q))
  }

  async function run(action, message) {
    try {
      await action()
      await reload()
      toast.success(message)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const handleAssign = (position, memberId) => {
    const name = membersById.get(memberId)?.full_name
    run(() => assignMember(position.id, memberId), name ? `${name} assigned` : 'Position is now vacant')
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{isAdviser ? 'Organization' : 'Step 2'}</p>
          <h1>{isAdviser ? 'Assigned Roles' : 'Assign Roles'}</h1>
          <p className="muted">
            {isAdviser
              ? 'View who holds each role.'
              : `${stats.filled} filled · ${stats.vacant} vacant across ${units.length} groups`}
          </p>
        </div>
        {!isAdviser && (
          <div className="header-actions">
            <button className="btn btn-soft" onClick={() => setUnitForm({})}>
              <FolderPlus size={18} /> New committee
            </button>
            <button className="btn btn-primary" onClick={() => setPositionForm({})} disabled={!units.length}>
              <Plus size={18} /> Add position
            </button>
          </div>
        )}
      </header>

      <div className="toolbar">
        <div className="search">
          <Search size={17} />
          <input placeholder="Search name, position or committee…" value={query} onChange={(e) => setQuery(e.target.value)} />
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
        <div className="unit-list">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton line w40" />
              <div className="skeleton line w80" />
              <div className="skeleton line w60" />
            </div>
          ))}
        </div>
      ) : (
        <div className="unit-list">
          {units.map((unit) => {
            const all = positionsByUnit.get(unit.id) ?? []
            const shown = all.filter((p) => visible(p, unit))
            if ((q || filter !== 'all') && !shown.length) return null
            const filled = all.filter((p) => p.member_id).length

            return (
              <section key={unit.id} className="unit-panel fade-in">
                <header className="unit-header">
                  <div className={`unit-icon ${unit.kind}`}>
                    {unit.kind === 'executive' ? <Crown size={18} /> : <Users size={18} />}
                  </div>
                  <div className="unit-title">
                    <h3>{unit.name}</h3>
                    <span className="muted small">
                      {filled}/{all.length} filled
                    </span>
                  </div>
                  <div className="mini-progress">
                    <div style={{ width: `${all.length ? (filled / all.length) * 100 : 0}%` }} />
                  </div>
                  {!isAdviser && (
                    <div className="unit-actions">
                      <button className="btn btn-soft btn-sm" onClick={() => setPositionForm({ unitId: unit.id })}>
                        <Plus size={15} /> Position
                      </button>
                      <button className="icon-btn" onClick={() => setUnitForm({ unit })} aria-label="Edit committee">
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-btn danger"
                        aria-label="Delete committee"
                        onClick={() =>
                          setConfirm({
                            title: 'Delete committee?',
                            message: `"${unit.name}" and all ${all.length} of its positions will be deleted. Members are kept.`,
                            action: () => run(() => deleteUnit(unit.id), 'Committee deleted'),
                          })
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </header>

                {shown.length ? (
                  <ul className="position-list">
                    {shown.map((p) => {
                      const m = membersById.get(p.member_id)
                      return (
                        <li key={p.id} className={`position-row ${m ? '' : 'is-vacant'}`}>
                          <div className="position-person">
                            <Avatar src={m?.photo_url} name={m?.full_name} size={42} />
                            <div>
                              <strong>{p.title}</strong>
                              <span>{m ? m.full_name : 'Vacant'}</span>
                            </div>
                          </div>
                          <span className={`badge level-${p.level}`}>{LEVELS[p.level].label}</span>
                          {!isAdviser && (
                            <>
                              <select
                                className="input input-sm assign-select"
                                value={p.member_id ?? ''}
                                onChange={(e) => handleAssign(p, e.target.value || null)}
                              >
                                <MemberOptions />
                              </select>
                              <div className="row-actions">
                                {m && (
                                  <button className="icon-btn" onClick={() => handleAssign(p, null)} title="Mark vacant">
                                    <UserMinus size={15} />
                                  </button>
                                )}
                                <button className="icon-btn" onClick={() => setPositionForm({ position: p })} title="Edit">
                                  <Pencil size={15} />
                                </button>
                                <button
                                  className="icon-btn danger"
                                  title="Delete"
                                  onClick={() =>
                                    setConfirm({
                                      title: 'Delete position?',
                                      message: `"${p.title}" in ${unit.name} will be deleted.`,
                                      action: () => run(() => deletePosition(p.id), 'Position deleted'),
                                    })
                                  }
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="muted small unit-empty">No positions yet.</p>
                )}
              </section>
            )
          })}
          {!units.length && (
            <div className="empty">
              <p>No committees yet. Run the seed script or create one.</p>
            </div>
          )}
        </div>
      )}

      {positionForm && (
        <PositionForm
          position={positionForm.position}
          unitId={positionForm.unitId}
          onClose={() => setPositionForm(null)}
        />
      )}
      {unitForm && <UnitForm unit={unitForm.unit} onClose={() => setUnitForm(null)} />}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.action}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
