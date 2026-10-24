import { useState } from 'react'
import Modal from './Modal'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { enrollMembers } from '../lib/api'
import { errorMessage } from '../lib/constants'
import { memberCode } from '../lib/tracker'

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
      const created = await enrollMembers(fresh)
      await reload()
      const numbered = created.filter((row) => row.member_no)
      const span = numbered.length
        ? numbered.length === 1
          ? ` ${memberCode(numbered[0].member_no)}.`
          : ` ${memberCode(numbered[0].member_no)}–${memberCode(numbered[numbered.length - 1].member_no)}.`
        : ''
      toast.success(`${created.length} member${created.length > 1 ? 's' : ''} added.${span} Usernames and default passwords are on Users.`)
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
