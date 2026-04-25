import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { StoredSession, Role, AdminRole } from '../types'

interface AuthContextValue {
  session: StoredSession | null
  loading: boolean
  signIn: (data: StoredSession) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const SESSION_KEY = 'gmp_session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function verifyAndLoad() {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) { setLoading(false); return }

      let stored: StoredSession
      try {
        stored = JSON.parse(raw) as StoredSession
      } catch {
        localStorage.removeItem(SESSION_KEY)
        setLoading(false)
        return
      }

      // Show cached session immediately — no spinner waiting for network
      setSession(stored)
      setLoading(false)

      // Verify in background (never blocks the UI)
      try {
        if (stored.role === 'admin') {
          const { data: { user }, error: authErr } = await supabase.auth.getUser()
          if (authErr || !user) return // Network issue — keep cached session
          const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('role, name, admin_role')
            .eq('id', user.id)
            .maybeSingle()
          if (profileErr || !profile) return // Network issue — keep cached session
          if (profile.role !== 'admin') {
            localStorage.removeItem(SESSION_KEY)
            await supabase.auth.signOut()
            setSession(null)
            return
          }
          // Refresh adminRole from DB in case it changed
          const refreshed: StoredSession = {
            ...stored,
            adminRole: (profile.admin_role as AdminRole) ?? 'admin',
          }
          localStorage.setItem(SESSION_KEY, JSON.stringify(refreshed))
          setSession(refreshed)
        } else {
          const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', stored.id)
            .maybeSingle()
          // Network error or missing row — keep cached session, don't logout
          if (profileErr || !profile) return
          // Only clear if role definitively changed to a known different role.
          // Guard against null/undefined role in DB causing a false logout.
          const knownRoles = ['admin', 'customer', 'worker', 'store']
          if (profile.role && knownRoles.includes(profile.role) && profile.role !== stored.role) {
            localStorage.removeItem(SESSION_KEY)
            setSession(null)
          }
        }
      } catch (err) {
        console.warn('Background session verify failed, keeping cached session:', err)
      }
    }

    verifyAndLoad()
  }, [])

  function signIn(data: StoredSession) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data))
    setSession(data)
  }

  async function signOut() {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
    await supabase.auth.signOut().catch(() => {})
  }

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}

export function useRequireAuth(role?: Role) {
  const { session, loading } = useAuth()
  return { session, loading, allowed: !loading && !!session && (!role || session.role === role) }
}
