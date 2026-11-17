const ACCESS_KEY = 'kislap-offline-access-v1'
const ORG_KEY = 'kislap-offline-org-v1'
const META_KEY = 'kislap-offline-meta-v1'

function readJson(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
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

export function saveOfflineAccess({ userId, profile, settings, pageAccess, setupNeeded }) {
  if (!userId) return
  writeJson(ACCESS_KEY, {
    userId,
    profile,
    settings,
    pageAccess: pageAccess || [],
    setupNeeded: Boolean(setupNeeded),
    savedAt: new Date().toISOString(),
  })
  writeJson(META_KEY, {
    lastUserId: userId,
    lastUsername: profile?.username || null,
    savedAt: new Date().toISOString(),
  })
}

export function loadOfflineAccess(userId) {
  const cached = readJson(ACCESS_KEY)
  if (!cached) return null
  if (userId && cached.userId !== userId) return null
  return {
    profile: cached.profile || null,
    settings: cached.settings || null,
    pageAccess: cached.pageAccess || [],
    setupNeeded: Boolean(cached.setupNeeded),
    savedAt: cached.savedAt || null,
  }
}

export function clearOfflineAccess() {
  localStorage.removeItem(ACCESS_KEY)
}

export function saveOfflineOrg(data) {
  writeJson(ORG_KEY, {
    ...data,
    savedAt: new Date().toISOString(),
  })
}

export function loadOfflineOrg() {
  return readJson(ORG_KEY)
}

export function clearOfflineOrg() {
  localStorage.removeItem(ORG_KEY)
}

export function loadOfflineMeta() {
  return readJson(META_KEY)
}

export function clearAllOfflineCaches() {
  clearOfflineAccess()
  clearOfflineOrg()
  localStorage.removeItem(META_KEY)
}
