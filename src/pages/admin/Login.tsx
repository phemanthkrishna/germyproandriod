import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

// Max failed attempts before temporary lockout
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 30_000 // 30 seconds

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  async function handleLogin() {
    // Lockout check
    if (lockedUntil && Date.now() < lockedUntil) {
      const secs = Math.ceil((lockedUntil - Date.now()) / 1000)
      toast.error(`Too many failed attempts. Try again in ${secs}s`)
      return
    }

    if (!email || !password) return toast.error('Fill in all fields')
    setLoading(true)

    try {
      // Server-side authentication via Supabase Auth — password never touches client code
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error || !data.user) {
        const next = attempts + 1
        setAttempts(next)
        if (next >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCKOUT_MS)
          setAttempts(0)
          toast.error('Too many failed attempts. Locked for 30 seconds.')
        } else {
          toast.error('Invalid credentials')
        }
        setLoading(false)
        return
      }

      // Verify the authenticated user actually has admin role in our profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, name, admin_role')
        .eq('id', data.user.id)
        .maybeSingle()

      if (profileError || !profile || profile.role !== 'admin') {
        await supabase.auth.signOut()
        toast.error('Access denied — not an admin account')
        setLoading(false)
        return
      }

      setAttempts(0)
      signIn({
        id: data.user.id,
        name: profile.name || 'Admin',
        phone: '',
        role: 'admin',
        adminRole: profile.admin_role ?? 'admin',
      })
      navigate('/admin')
    } catch {
      toast.error('Login failed, please try again')
    }
    setLoading(false)
  }

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil

  return (
    <div className="min-h-dvh flex flex-col px-5 py-8">
      <button onClick={() => navigate('/')} className="text-slate-400 mb-8">← Back</button>

      <div className="mb-8">
        <h1 className="text-3xl font-black font-heading text-slate-50">Admin ⚙️</h1>
        <p className="text-slate-400 mt-1">Sign in to manage GetMyPro</p>
      </div>

      {isLocked && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-red-400 text-sm">
          🔒 Too many failed attempts. Wait 30 seconds before trying again.
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          placeholder="admin@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={isLocked}
        />
        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !isLocked && handleLogin()}
          disabled={isLocked}
        />
        <Button size="lg" loading={loading} onClick={handleLogin} disabled={isLocked}>
          Sign In →
        </Button>
      </div>
    </div>
  )
}
