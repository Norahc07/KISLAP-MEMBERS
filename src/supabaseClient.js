import { createClient } from '@supabase/supabase-js'
import { isOnline, subscribeOnline } from './lib/offlineCache'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient(url || 'http://localhost', anonKey || 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/** Pause token refresh while offline so a field session is not wiped. */
export function syncAuthRefreshWithConnectivity(online = isOnline()) {
  try {
    if (online) supabase.auth.startAutoRefresh()
    else supabase.auth.stopAutoRefresh()
  } catch {
    /* ignore older clients */
  }
}

let unsubscribeConnectivity = null

export function startAuthConnectivityGuard() {
  syncAuthRefreshWithConnectivity()
  if (unsubscribeConnectivity) unsubscribeConnectivity()
  unsubscribeConnectivity = subscribeOnline((online) => {
    syncAuthRefreshWithConnectivity(online)
  })
  return () => {
    if (unsubscribeConnectivity) unsubscribeConnectivity()
    unsubscribeConnectivity = null
  }
}
