import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_COLORS } from '../../lib/adminRoles'
import { UserPlus, Trash2, RefreshCw } from 'lucide-react'
import type { AdminRole } from '../../types'

interface AdminAccount {
  id: string
  name: string
  phone: string
  admin_role: AdminRole
  created_at: string
  email?: string
}

const EMPTY_FORM = { name: '', email: '', password: '', adminRole: 'manager' as AdminRole }

function genPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function AdminAccounts() {
  const { session } = useAuth()
  const [accounts, setAccounts] = useState<AdminAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showPassword, setShowPassword] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [changingRole, setChangingRole] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, name, phone, admin_role, created_at')
      .eq('role', 'admin')
      .order('created_at', { ascending: true })
    setAccounts((data as AdminAccount[]) || [])
    setLoading(false)
  }

  async function createAccount() {
    if (!form.name.trim()) return toast.error('Enter a name')
    if (!form.email.trim()) return toast.error('Enter an email')
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters')

    setSaving(true)
    try {
      // Create Supabase Auth user via admin API (service role needed — use edge function or direct)
      // We use supabase.auth.admin which requires service role — not available client-side.
      // Instead: use signUp + immediate profile update via service role workaround.
      // We call a lightweight inline approach: create user via signup, then update profile.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          data: { name: form.name.trim() },
          // Don't send confirmation email — admin panel is internal
          emailRedirectTo: undefined,
        },
      })

      if (authError) {
        toast.error(authError.message.includes('already registered')
          ? 'An account with this email already exists'
          : authError.message)
        setSaving(false)
        return
      }

      if (!authData.user) {
        toast.error('Failed to create auth user')
        setSaving(false)
        return
      }

      // Upsert profile with admin role
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: authData.user.id,
        name: form.name.trim(),
        phone: '',
        role: 'admin',
        admin_role: form.adminRole,
      })

      if (profileError) {
        toast.error('Created auth account but failed to set role: ' + profileError.message)
        setSaving(false)
        return
      }

      toast.success(`${form.name} (${ROLE_LABELS[form.adminRole]}) account created ✓`)
      setForm(EMPTY_FORM)
      setShowForm(false)
      load()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create account')
    }
    setSaving(false)
  }

  async function changeRole(account: AdminAccount, newRole: AdminRole) {
    if (account.id === session?.id) {
      toast.error("You can't change your own role")
      return
    }
    setChangingRole(account.id)
    const { error } = await supabase
      .from('profiles')
      .update({ admin_role: newRole })
      .eq('id', account.id)
    if (error) toast.error('Failed to update role')
    else {
      toast.success(`${account.name} → ${ROLE_LABELS[newRole]}`)
      setAccounts(prev => prev.map(a => a.id === account.id ? { ...a, admin_role: newRole } : a))
    }
    setChangingRole(null)
  }

  async function resetPassword(account: AdminAccount) {
    const newPass = genPassword()
    if (!confirm(`Reset password for ${account.name}? New password will be shown once.`)) return
    // Send password reset email via Supabase
    const { error } = await supabase.auth.resetPasswordForEmail(account.email || '', {
      redirectTo: `${window.location.origin}/admin/login`,
    })
    if (error) {
      toast.error('Failed to send reset email: ' + error.message)
    } else {
      toast.success(`Password reset email sent to ${account.name}`)
    }
  }

  async function deleteAccount(account: AdminAccount) {
    if (account.id === session?.id) {
      toast.error("You can't delete your own account")
      return
    }
    if (!confirm(`Delete ${account.name}'s account? They will lose all access immediately. This cannot be undone.`)) return
    setDeleting(account.id)
    // Remove admin role from profile (keeps order history intact)
    const { error } = await supabase
      .from('profiles')
      .update({ role: 'customer', admin_role: null })
      .eq('id', account.id)
    if (error) toast.error('Failed to remove account access')
    else {
      toast.success(`${account.name} access removed`)
      setAccounts(prev => prev.filter(a => a.id !== account.id))
    }
    setDeleting(null)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black font-heading text-slate-50">Admin Accounts</h1>
          <p className="text-slate-400 text-sm mt-0.5">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setForm({ ...EMPTY_FORM, password: genPassword() }); setShowForm(true) }}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded-full transition-colors"
        >
          <UserPlus size={15} /> Add Account
        </button>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {(Object.entries(ROLE_DESCRIPTIONS) as [AdminRole, string][]).map(([role, desc]) => (
          <div key={role} className={`border rounded-xl p-3 ${ROLE_COLORS[role]}`}>
            <p className="font-bold text-sm mb-0.5">{ROLE_LABELS[role]}</p>
            <p className="text-[10px] opacity-70 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-slate-800 border border-blue-500/40 rounded-2xl p-5 mb-5">
          <p className="text-slate-50 font-bold text-sm mb-4">New Admin Account</p>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1">Full Name</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Ravi Kumar"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-50 placeholder-slate-600 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="ravi@getmypro.in"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-50 placeholder-slate-600 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1">Password</label>
              <div className="flex gap-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-50 font-mono text-sm outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="px-3 py-2 bg-slate-700 text-slate-300 text-xs rounded-xl"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, password: genPassword() }))}
                  className="px-3 py-2 bg-slate-700 text-slate-300 text-xs rounded-xl"
                >
                  Generate
                </button>
              </div>
              <p className="text-slate-600 text-xs mt-1">Share this password securely — they can change it after login.</p>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-2">Role</label>
              <div className="flex flex-col gap-2">
                {(Object.keys(ROLE_LABELS) as AdminRole[]).map(role => (
                  <label key={role} className={`flex items-start gap-3 border rounded-xl p-3 cursor-pointer transition-colors ${
                    form.adminRole === role ? ROLE_COLORS[role] : 'border-slate-700 bg-slate-900'
                  }`}>
                    <input
                      type="radio"
                      name="adminRole"
                      value={role}
                      checked={form.adminRole === role}
                      onChange={() => setForm(f => ({ ...f, adminRole: role }))}
                      className="mt-0.5 shrink-0 accent-blue-500"
                    />
                    <div>
                      <p className="text-slate-50 text-sm font-bold">{ROLE_LABELS[role]}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{ROLE_DESCRIPTIONS[role]}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={createAccount}
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm"
              >
                {saving ? 'Creating…' : 'Create Account'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 bg-slate-700 text-slate-300 font-bold rounded-xl text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accounts list */}
      {loading ? (
        <p className="text-slate-400 text-sm text-center py-10">Loading…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {accounts.map(a => {
            const isMe = a.id === session?.id
            const role = a.admin_role ?? 'admin'
            return (
              <div key={a.id} className={`bg-slate-800 border rounded-2xl p-4 ${isMe ? 'border-blue-500/40' : 'border-slate-700'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-slate-50 font-black text-sm shrink-0">
                      {a.name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-slate-50 font-bold text-sm">{a.name}</p>
                        {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold">You</span>}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border mt-1 inline-block ${ROLE_COLORS[role]}`}>
                        {ROLE_LABELS[role]}
                      </span>
                    </div>
                  </div>

                  {!isMe && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => resetPassword(a)}
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
                        title="Send password reset email"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button
                        onClick={() => deleteAccount(a)}
                        disabled={deleting === a.id}
                        className="p-2 rounded-lg text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                        title="Remove access"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Role changer */}
                {!isMe && (
                  <div className="mt-3 pt-3 border-t border-slate-700 flex gap-1.5 flex-wrap">
                    {(Object.keys(ROLE_LABELS) as AdminRole[]).map(r => (
                      <button
                        key={r}
                        onClick={() => changeRole(a, r)}
                        disabled={changingRole === a.id || role === r}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                          role === r ? ROLE_COLORS[r] : 'border-slate-600 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {role === r ? `✓ ${ROLE_LABELS[r]}` : ROLE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
