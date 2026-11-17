import { upsertYouthProfile } from './youthApi'

const DB_NAME = 'kislap_youth_offline'
const DB_VERSION = 1
const STORE = 'profiles'

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error || new Error('Could not open offline store'))
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'client_id' })
        store.createIndex('sync_status', 'sync_status', { unique: false })
        store.createIndex('barangay', 'barangay', { unique: false })
      }
    }
  })
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'))
  })
}

export async function saveLocalYouth(form, { syncStatus = 'pending' } = {}) {
  const db = await openDb()
  const record = {
    ...form,
    client_id: form.client_id,
    sync_status: syncStatus,
    updated_locally_at: new Date().toISOString(),
    full_name: [form.first_name, form.middle_name, form.last_name, form.suffix]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' '),
  }
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).put(record)
  await txDone(tx)
  db.close()
  return record
}

export async function getLocalYouth(clientId) {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readonly')
  const request = tx.objectStore(STORE).get(clientId)
  const row = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
  await txDone(tx)
  db.close()
  return row
}

export async function listLocalYouth() {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readonly')
  const request = tx.objectStore(STORE).getAll()
  const rows = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
  await txDone(tx)
  db.close()
  return rows.sort((a, b) => String(a.barangay || '').localeCompare(String(b.barangay || '')) || String(a.last_name || '').localeCompare(String(b.last_name || '')))
}

export async function listPendingYouth() {
  const rows = await listLocalYouth()
  return rows.filter((row) => row.sync_status === 'pending' || row.sync_status === 'error')
}

export async function markLocalSynced(clientId, remoteRow = null) {
  const existing = await getLocalYouth(clientId)
  if (!existing) return null
  return saveLocalYouth(
    {
      ...existing,
      ...(remoteRow || {}),
      client_id: clientId,
      id: remoteRow?.id || existing.id,
    },
    { syncStatus: 'synced' },
  )
}

export async function removeLocalYouth(clientId) {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).delete(clientId)
  await txDone(tx)
  db.close()
}

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export async function syncPendingYouth({ collectedBy = null, onProgress } = {}) {
  if (!isOnline()) return { synced: 0, failed: 0, remaining: (await listPendingYouth()).length }
  const pending = await listPendingYouth()
  let synced = 0
  let failed = 0
  for (const row of pending) {
    try {
      const remote = await upsertYouthProfile(row, { collectedBy })
      await markLocalSynced(row.client_id, remote)
      synced += 1
      onProgress?.({ synced, failed, current: row })
    } catch (error) {
      failed += 1
      await saveLocalYouth({ ...row, last_sync_error: error.message || String(error) }, { syncStatus: 'error' })
      onProgress?.({ synced, failed, current: row, error })
    }
  }
  return { synced, failed, remaining: (await listPendingYouth()).length }
}

export function subscribeOnline(callback) {
  const handler = () => callback(isOnline())
  window.addEventListener('online', handler)
  window.addEventListener('offline', handler)
  return () => {
    window.removeEventListener('online', handler)
    window.removeEventListener('offline', handler)
  }
}
