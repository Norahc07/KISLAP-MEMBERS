import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    ready,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: async () => {
      setSession(null)
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
