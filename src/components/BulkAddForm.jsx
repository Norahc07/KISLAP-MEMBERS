import { useState } from 'react'
import Modal from './Modal'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { createMembers } from '../lib/api'
import { errorMessage } from '../lib/constants'

export default function BulkAddForm({ onClose }) {
  const { members, reload } = useData()
  const toast = useToast()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const existing = new Set(members.map((m) => m.full_name.trim().toLowerCase()))
  const names = [...new Set(text.split('\n').map((n) => n.trim()).filter(Boolean))]
  const fresh = names.filter((n) => !existing.has(n.toLowerCase()))

  async function handleSave() {
    if (!fresh.length) return toast.error('No new names to add.')
    setSaving(true)
    try {
      await createMembers(fresh)
      await reload()
      toast.success(`${fresh.length} member${fresh.length > 1 ? 's' : ''} added`)
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Bulk add members"
      subtitle="Paste one full name per line"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !fresh.length}>
            {saving ? 'Adding…' : `Add ${fresh.length || ''} member${fresh.length === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <div className="form">
        <textarea
          className="input textarea"
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'JUAN DELA CRUZ\nMARIA CLARA\nJOSE RIZAL'}
          autoFocus
        />
        <p className="muted small">
          {names.length} name{names.length === 1 ? '' : 's'} detected
          {names.length !== fresh.length && ` · ${names.length - fresh.length} already exist and will be skipped`}
        </p>
      </div>
    </Modal>
  )
}
