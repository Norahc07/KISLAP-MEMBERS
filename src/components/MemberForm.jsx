import { useMemo, useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import Modal from './Modal'
import Avatar from './Avatar'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { assignMember, enrollMember, removePhoto, updateMember, uploadPhoto } from '../lib/api'
import { errorMessage } from '../lib/constants'

export default function MemberForm({ member, onClose }) {
  const { units, positionsByUnit, rolesByMember, reload } = useData()
  const toast = useToast()
  const fileInput = useRef(null)

  const currentPositionId = member ? rolesByMember.get(member.id)?.[0]?.position.id ?? '' : ''
  const [name, setName] = useState(member?.full_name ?? '')
  const [positionId, setPositionId] = useState(currentPositionId)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(member?.photo_url ?? null)
  const [saving, setSaving] = useState(false)

  const positionGroups = useMemo(
    () =>
      units
        .map((u) => ({
          unit: u,
          positions: (positionsByUnit.get(u.id) ?? []).filter(
            (p) => !p.member_id || p.id === currentPositionId,
          ),
        }))
        .filter((g) => g.positions.length),
    [units, positionsByUnit, currentPositionId],
  )

  function pickFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) return toast.error('Please choose an image file.')
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  function clearPhoto() {
    setFile(null)
    setPreview(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const full_name = name.trim()
    if (!full_name) return toast.error('Name is required.')

    setSaving(true)
    try {
      let photo = { photo_url: member?.photo_url ?? null, photo_path: member?.photo_path ?? null }
      if (file) photo = await uploadPhoto(file)
      else if (!preview) photo = { photo_url: null, photo_path: null }

      let saved = member
      if (member) {
        saved = await updateMember(member.id, { full_name, ...photo })
        if (member.photo_path && member.photo_path !== photo.photo_path) await removePhoto(member.photo_path)
        if (positionId !== currentPositionId) {
          if (currentPositionId) await assignMember(currentPositionId, null)
          if (positionId) await assignMember(positionId, saved.id)
        }
      } else {
        saved = await enrollMember({
          full_name,
          photo_url: photo.photo_url,
          photo_path: photo.photo_path,
          position_id: positionId || null,
        })
      }

      await reload()
      toast.success(member ? 'Member updated' : `${saved.full_name} is ${saved.username}. The default password is on Users.`)
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={member ? 'Edit member' : 'Add member'}
      subtitle="Profile photo, name and role"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="member-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : member ? 'Save changes' : 'Add member'}
          </button>
        </>
      }
    >
      <form id="member-form" className="form" onSubmit={handleSubmit}>
        <div className="photo-picker">
          <button type="button" className="photo-drop" onClick={() => fileInput.current?.click()}>
            <Avatar src={preview} name={name.trim() || null} size={96} />
            <span className="photo-overlay">
              <Camera size={20} />
            </span>
          </button>
          <div className="photo-actions">
            <button type="button" className="btn btn-soft btn-sm" onClick={() => fileInput.current?.click()}>
              <Camera size={15} /> {preview ? 'Change photo' : 'Upload photo'}
            </button>
            {preview && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearPhoto}>
                <Trash2 size={15} /> Remove
              </button>
            )}
            <small className="muted">JPG or PNG. Auto-cropped to a square.</small>
          </div>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickFile} />
        </div>

        <label className="field">
          <span>Full name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. JUAN DELA CRUZ"
            autoFocus
          />
        </label>

        <label className="field">
          <span>Role / position</span>
          <select className="input" value={positionId} onChange={(e) => setPositionId(e.target.value)}>
            <option value="">No role yet</option>
            {positionGroups.map(({ unit, positions }) => (
              <optgroup key={unit.id} label={unit.name}>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <small className="muted">Only vacant positions are listed.</small>
        </label>
      </form>
    </Modal>
  )
}
