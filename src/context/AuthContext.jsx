import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { ADMIN_EMAIL, canSeeTracker, loginEmail } from '../lib/accounts'

const AuthContext = createContext(null)

async function loadAccess(session) {
  if (!session) return { profile: null, settings: null, setupNeeded: false }
  const [profileResult, settingsResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
    supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(),
  ])
  const missing = profileResult.error?.code === 'PGRST205' || settingsResult.error?.code === 'PGRST205'
  return {
    profile: profileResult.data || null,
    settings: settingsResult.data || null,
    setupNeeded: missing,
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [settings, setSettings] = useState(null)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [ready, setReady] = useState(false)

  async function applySession(next) {
    setSession(next)
    const access = await loadAccess(next)
    setProfile(access.profile)
    setSettings(access.settings)
    setSetupNeeded(access.setupNeeded)
  }

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

  async function refreshAccess() {
    const access = await loadAccess(session)
    setProfile(access.profile)
    setSettings(access.settings)
    setSetupNeeded(access.setupNeeded)
  }

  function markPasswordChanged(password) {
    setProfile((current) => (current ? { ...current, must_change_password: false, initial_password: password } : current))
  }

  useEffect(() => {
    if (!session?.user) return undefined
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
  }, [session?.user?.id])

  const user = session?.user ?? null
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL || profile?.role === 'admin'
  const mustChangePassword = Boolean(profile?.must_change_password)

  const value = {
    session,
    user,
    profile,
    settings,
    setupNeeded,
    ready,
    isAdmin,
    mustChangePassword,
    canSeeTracker: canSeeTracker(profile, settings, isAdmin),
    refreshAccess,
    markPasswordChanged,
    signIn: async (username, password) => {
      const email = loginEmail(username)
      if (!email) return { error: { message: 'Use admin or a membership ID such as KISLAP-26-001.' } }
      const result = await supabase.auth.signInWithPassword({ email, password })
      if (!result.error) {
        supabase.rpc('log_audit', { p_action: 'sign_in', p_summary: 'Signed in', p_detail: {} }).then(() => {}, () => {})
      }
      return result
    },
    signOut: async () => {
      const presenceId = sessionStorage.getItem('kislap-presence-id')
      if (presenceId) {
        await Promise.race([
          supabase.rpc('end_session', { p_session_id: presenceId }),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]).catch(() => {})
        sessionStorage.removeItem('kislap-presence-id')
      }
      setSession(null)
      setProfile(null)
      setSettings(null)
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
