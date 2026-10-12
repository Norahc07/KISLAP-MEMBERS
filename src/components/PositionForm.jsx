import { useState } from 'react'
import Modal from './Modal'
import MemberOptions from './MemberOptions'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { createPositions, updatePosition } from '../lib/api'
import { LEVELS, errorMessage } from '../lib/constants'

export default function PositionForm({ position, unitId, onClose }) {
  const { units, positionsByUnit, reload } = useData()
  const toast = useToast()
  const [form, setForm] = useState({
    unit_id: position?.unit_id ?? unitId ?? units[0]?.id ?? '',
    title: position?.title ?? 'Member',
    level: position?.level ?? 'member',
    member_id: position?.member_id ?? '',
  })
  const [saving, setSaving] = useState(false)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Title is required.')
    if (!form.unit_id) return toast.error('Choose a committee.')

    const values = { ...form, title: form.title.trim(), member_id: form.member_id || null }
    setSaving(true)
    try {
      if (position) {
        await updatePosition(position.id, values)
      } else {
        const siblings = positionsByUnit.get(form.unit_id) ?? []
        const sort_order = Math.max(0, ...siblings.map((p) => p.sort_order)) + 1
        await createPositions([{ ...values, sort_order }])
      }
      await reload()
      toast.success(position ? 'Position updated' : 'Position added')
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={position ? 'Edit position' : 'Add position'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="position-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="position-form" className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Committee / group</span>
          <select className="input" value={form.unit_id} onChange={set('unit_id')}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <div className="field-row">
          <label className="field">
            <span>Position title</span>
            <input className="input" value={form.title} onChange={set('title')} autoFocus />
          </label>
          <label className="field">
            <span>Level</span>
            <select className="input" value={form.level} onChange={set('level')}>
              {Object.entries(LEVELS).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Assigned to</span>
          <select className="input" value={form.member_id} onChange={set('member_id')}>
            <MemberOptions />
          </select>
        </label>
      </form>
    </Modal>
  )
}
