import { supabase } from '../supabaseClient'

const BUCKET = 'avatars'

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

export async function fetchAll() {
  const [members, units, positions] = await Promise.all([
    supabase.from('members').select('*').order('full_name'),
    supabase.from('units').select('*').order('sort_order').order('name'),
    supabase.from('positions').select('*').order('sort_order').order('created_at'),
  ])
  return { members: unwrap(members), units: unwrap(units), positions: unwrap(positions) }
}

// Members
export const createMember = (values) =>
  supabase.from('members').insert(values).select().single().then(unwrap)

export const createMembers = (names) =>
  supabase.from('members').insert(names.map((full_name) => ({ full_name }))).select().then(unwrap)

export const updateMember = (id, values) =>
  supabase.from('members').update(values).eq('id', id).select().single().then(unwrap)

export async function deleteMember(member) {
  unwrap(await supabase.from('members').delete().eq('id', member.id))
  if (member.photo_path) await removePhoto(member.photo_path)
}

// Units (Executive board / committees)
export const createUnit = (values) =>
  supabase.from('units').insert(values).select().single().then(unwrap)

export const updateUnit = (id, values) =>
  supabase.from('units').update(values).eq('id', id).select().single().then(unwrap)

export const deleteUnit = (id) => supabase.from('units').delete().eq('id', id).then(unwrap)

// Positions
export const createPositions = (rows) => supabase.from('positions').insert(rows).select().then(unwrap)

export const updatePosition = (id, values) =>
  supabase.from('positions').update(values).eq('id', id).select().single().then(unwrap)

export const deletePosition = (id) => supabase.from('positions').delete().eq('id', id).then(unwrap)

export const assignMember = (positionId, memberId) => updatePosition(positionId, { member_id: memberId })

export async function fetchMemberPhotos() {
  const { data, error } = await supabase.from('membership_tracker').select('member_no, members(photo_url)')
  if (error) throw error
  return new Map(
    (data || [])
      .filter((row) => row.members?.photo_url)
      .map((row) => [row.member_no, row.members.photo_url]),
  )
}

export async function fetchTracker() {
  const [tracker, members] = await Promise.all([
    supabase.from('membership_tracker').select('*').order('member_no'),
    supabase.from('members').select('id, full_name, photo_url').order('full_name'),
  ])
  return { rows: unwrap(tracker), members: unwrap(members) }
}

export const updateTracker = (id, values) =>
  supabase.from('membership_tracker').update(values).eq('id', id).select().single().then(unwrap)

// Photos
export async function uploadPhoto(file) {
  const blob = await squareResize(file, 512)
  const path = `members/${crypto.randomUUID()}.jpg`
  unwrap(await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' }))
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { photo_url: data.publicUrl, photo_path: path }
}

export async function uploadProfilePhoto(userId, file) {
  const blob = await squareResize(file, 512)
  const path = `profiles/${userId}.jpg`
  unwrap(await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true }))
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const photo_url = `${data.publicUrl}?v=${Date.now()}`
  unwrap(await supabase.rpc('save_profile_photo', { p_url: photo_url, p_path: path }))
  return { photo_url, photo_path: path }
}

export async function removePhoto(path) {
  await supabase.storage.from(BUCKET).remove([path])
}

function squareResize(file, max) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const src = URL.createObjectURL(file)
    img.onload = () => {
      const side = Math.min(img.width, img.height)
      const out = Math.min(max, side)
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = out
      canvas
        .getContext('2d')
        .drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, out, out)
      URL.revokeObjectURL(src)
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process image'))), 'image/jpeg', 0.85)
    }
    img.onerror = () => {
      URL.revokeObjectURL(src)
      reject(new Error('Invalid image file'))
    }
    img.src = src
  })
}
