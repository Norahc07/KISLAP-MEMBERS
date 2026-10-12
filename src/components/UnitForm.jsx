import { useState } from 'react'
import Modal from './Modal'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { createPositions, createUnit, updateUnit } from '../lib/api'
import { errorMessage } from '../lib/constants'

export default function UnitForm({ unit, onClose }) {
  const { units, reload } = useData()
  const toast = useToast()
  const [name, setName] = useState(unit?.name ?? '')
  const [kind, setKind] = useState(unit?.kind ?? 'committee')
  const [withLeads, setWithLeads] = useState(true)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return toast.error('Name is required.')

    setSaving(true)
    try {
      if (unit) {
        await updateUnit(unit.id, { name: clean, kind })
      } else {
        const sort_order = Math.max(0, ...units.map((u) => u.sort_order)) + 1
        const created = await createUnit({ name: clean, kind, sort_order })
        if (kind === 'committee' && withLeads) {
          await createPositions([
            { unit_id: created.id, title: `${clean} Director`, level: 'director', sort_order: 1 },
            { unit_id: created.id, title: 'Asst. Director', level: 'assistant', sort_order: 2 },
          ])
        }
      }
      await reload()
      toast.success(unit ? 'Committee updated' : 'Committee created')
      onClose()
    } catch (err) {
      toast.error(err?.code === '23505' ? 'A committee with that name already exists.' : errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={unit ? 'Edit committee' : 'New committee'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="unit-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="unit-form" className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Arts and Culture"
            autoFocus
          />
        </label>
        <label className="field">
          <span>Type</span>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="committee">Standing committee</option>
            <option value="executive">Executive board</option>
          </select>
        </label>
        {!unit && kind === 'committee' && (
          <label className="check">
            <input type="checkbox" checked={withLeads} onChange={(e) => setWithLeads(e.target.checked)} />
            <span>Create vacant Director and Asst. Director positions</span>
          </label>
        )}
      </form>
    </Modal>
  )
}
