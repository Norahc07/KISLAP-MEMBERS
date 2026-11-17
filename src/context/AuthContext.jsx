import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { ADMIN_EMAIL, canAccessStaffPage, canDoStaffAction, canSeeTracker, loginEmail } from '../lib/accounts'
import {
  clearAllOfflineCaches,
  clearOfflineAccess,
  isOnline,
  loadOfflineAccess,
  saveOfflineAccess,
  subscribeOnline,
} from '../lib/offlineCache'

const AuthContext = createContext(null)

function isNetworkError(error) {
  if (!error) return false
  const message = String(error.message || error).toLowerCase()
  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('fetch') ||
    error.name === 'TypeError'
  )
}

async function loadAccess(session) {
  if (!session) return { profile: null, settings: null, pageAccess: [], setupNeeded: false, fromCache: false }
  try {
    const [profileResult, settingsResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(),
    ])

    if (profileResult.error && isNetworkError(profileResult.error)) throw profileResult.error
    if (settingsResult.error && isNetworkError(settingsResult.error)) throw settingsResult.error

    const missing = profileResult.error?.code === 'PGRST205' || settingsResult.error?.code === 'PGRST205'
    const profile = profileResult.data || null
    let pageAccess = []
    if (profile?.member_no) {
      const pagesResult = await supabase
        .from('staff_page_access')
        .select('pages')
        .eq('member_no', profile.member_no)
        .maybeSingle()
      if (pagesResult.error && isNetworkError(pagesResult.error)) throw pagesResult.error
      if (pagesResult.error?.code === 'PGRST205') {
        return { profile, settings: settingsResult.data || null, pageAccess: [], setupNeeded: true, fromCache: false }
      }
      pageAccess = pagesResult.data?.pages || []
    }
    return {
      profile,
      settings: settingsResult.data || null,
      pageAccess,
      setupNeeded: missing,
      fromCache: false,
    }
  } catch (error) {
    const cached = loadOfflineAccess(session.user.id)
    if (cached) {
      return { ...cached, fromCache: true }
    }
    if (!isOnline() || isNetworkError(error)) {
      return { profile: null, settings: null, pageAccess: [], setupNeeded: false, fromCache: false, offlineError: true }
    }
    throw error
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [settings, setSettings] = useState(null)
  const [pageAccess, setPageAccess] = useState([])
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [ready, setReady] = useState(false)
  const [online, setOnline] = useState(isOnline())
  const [usingCachedAccess, setUsingCachedAccess] = useState(false)

  async function applySession(next) {
    setSession(next)
    if (!next) {
      setProfile(null)
      setSettings(null)
      setPageAccess([])
      setSetupNeeded(false)
      setUsingCachedAccess(false)
      return
    }
    const access = await loadAccess(next)
    setProfile(access.profile)
    setSettings(access.settings)
    setPageAccess(access.pageAccess)
    setSetupNeeded(access.setupNeeded)
    setUsingCachedAccess(Boolean(access.fromCache))
    if (!access.fromCache && access.profile) {
      saveOfflineAccess({
        userId: next.user.id,
        profile: access.profile,
        settings: access.settings,
        pageAccess: access.pageAccess,
        setupNeeded: access.setupNeeded,
      })
    }
  }

  useEffect(() => subscribeOnline(setOnline), [])

  useEffect(() => {
    let ignore = false
    supabase.auth.getSession().then(async ({ data }) => {
      if (ignore) return
      await applySession(data.session)
      if (!ignore) setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      applySession(next)
    })
    return () => {
      ignore = true
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!online || !session?.user) return undefined
    let ignore = false
    loadAccess(session).then((access) => {
      if (ignore || access.fromCache || access.offlineError) return
      setProfile(access.profile)
      setSettings(access.settings)
      setPageAccess(access.pageAccess)
      setSetupNeeded(access.setupNeeded)
      setUsingCachedAccess(false)
      if (access.profile) {
        saveOfflineAccess({
          userId: session.user.id,
          profile: access.profile,
          settings: access.settings,
          pageAccess: access.pageAccess,
          setupNeeded: access.setupNeeded,
        })
      }
    })
    return () => {
      ignore = true
    }
  }, [online, session?.user?.id])

  async function refreshAccess() {
    const access = await loadAccess(session)
    setProfile(access.profile)
    setSettings(access.settings)
    setPageAccess(access.pageAccess)
    setSetupNeeded(access.setupNeeded)
    setUsingCachedAccess(Boolean(access.fromCache))
    if (!access.fromCache && session?.user && access.profile) {
      saveOfflineAccess({
        userId: session.user.id,
        profile: access.profile,
        settings: access.settings,
        pageAccess: access.pageAccess,
        setupNeeded: access.setupNeeded,
      })
    }
  }

  function markPasswordChanged(password) {
    setProfile((current) => {
      const next = current ? { ...current, must_change_password: false, initial_password: password } : current
      if (next && session?.user) {
        saveOfflineAccess({
          userId: session.user.id,
          profile: next,
          settings,
          pageAccess,
          setupNeeded,
        })
      }
      return next
    })
  }

  useEffect(() => {
    if (!session?.user || !online) return undefined
    const key = 'kislap-presence-id'
    let id = sessionStorage.getItem(key)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(key, id)
    }
    const pulse = () => supabase.rpc('pulse_session', { p_session_id: id }).then(() => {}, () => {})
    pulse()
    const timer = setInterval(pulse, 15000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') pulse()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [session?.user?.id, online])

  const user = session?.user ?? null
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL || profile?.role === 'admin'
  const isAdviser = profile?.role === 'adviser'
  const mustChangePassword = Boolean(profile?.must_change_password)
  const accessArgs = { isAdmin, isAdviser, profile, settings, pageAccess }

  const value = {
    session,
    user,
    profile,
    settings,
    pageAccess,
    setupNeeded,
    ready,
    online,
    usingCachedAccess,
    isAdmin,
    isAdviser,
    mustChangePassword,
    canSeeTracker: canSeeTracker(profile, settings, isAdmin, pageAccess),
    canAccessPage: (page) => canAccessStaffPage(page, accessArgs),
    canDo: (action) => canDoStaffAction(action, accessArgs),
    refreshAccess,
    markPasswordChanged,
    signIn: async (username, password) => {
      if (!isOnline()) {
        return {
          error: {
            message:
              'You are offline. Sign in once while online, then you can reopen KISLAP offline with the saved session.',
          },
        }
      }
      const email = loginEmail(String(username || '').replace(/[\u200B-\u200D\uFEFF]/g, ''))
      if (!email) return { error: { message: 'Use admin, a membership ID such as KISLAP-26-001, or an adviser username such as RICHMOND.BANAAG.' } }
      const result = await supabase.auth.signInWithPassword({
        email,
        password: String(password || '').trim(),
      })
      if (!result.error) {
        supabase.rpc('log_audit', { p_action: 'sign_in', p_summary: 'Signed in', p_detail: {} }).then(() => {}, () => {})
      }
      return result
    },
    signOut: async () => {
      const presenceId = sessionStorage.getItem('kislap-presence-id')
      if (presenceId && isOnline()) {
        await Promise.race([
          supabase.rpc('end_session', { p_session_id: presenceId }),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]).catch(() => {})
        sessionStorage.removeItem('kislap-presence-id')
      }
      setSession(null)
      setProfile(null)
      setSettings(null)
      setPageAccess([])
      setUsingCachedAccess(false)
      clearOfflineAccess()
      clearAllOfflineCaches()
      try {
        await Promise.race([
          supabase.auth.signOut({ scope: 'local' }),
          new Promise((resolve) => setTimeout(resolve, 3000)),
        ])
      } finally {
        Object.keys(localStorage)
          .filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token'))
          .forEach((key) => localStorage.removeItem(key))
      }
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
