import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useCity } from '../../context/CityContext'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { MILESTONES } from '../../hooks/useWorkerProgress'
import type { Worker } from '../../types'

export default function AdminWorkers() {
  const { selectedCity } = useCity()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [jobCounts, setJobCounts] = useState<Record<string, number>>({})
  const [earnings, setEarnings] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchWorkers()
    const channel = supabase
      .channel('admin-workers')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workers' }, () => fetchWorkers())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workers' }, () => fetchWorkers())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedCity])

  async function fetchWorkers() {
    let query = supabase.from('workers').select('*').order('created_at', { ascending: false })
    if (selectedCity) query = query.eq('city', selectedCity)
    const { data, error } = await query
    if (error) console.error('Failed to load workers:', error.message)
    const list = (data as Worker[]) || []
    setWorkers(list)

    if (list.length > 0) {
      const ids = list.map(w => w.id)
      const [{ data: orders }, { data: logs }] = await Promise.all([
        supabase.from('orders').select('worker_id').in('worker_id', ids).eq('status', 'completed'),
        supabase.from('payout_logs').select('payee_id,amount').in('payee_id', ids).eq('payee_type', 'worker'),
      ])
      const counts: Record<string, number> = {}
      for (const o of (orders || [])) {
        if (o.worker_id) counts[o.worker_id] = (counts[o.worker_id] || 0) + 1
      }
      setJobCounts(counts)
      const earned: Record<string, number> = {}
      for (const l of (logs || [])) {
        if (l.payee_id) earned[l.payee_id] = (earned[l.payee_id] || 0) + (l.amount || 0)
      }
      setEarnings(earned)
    }
  }

  function waitingDays(createdAt: string) {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400_000)
  }

  async function verify(w: Worker) {
    setSaving(w.id)
    const { error } = await supabase.from('workers').update({ verified: true, is_active: true }).eq('id', w.id)
    if (error) { toast.error('Failed to verify worker, please try again'); setSaving(null); return }
    toast.success(`${w.name} verified ✓`)
    fetchWorkers()
    setSaving(null)
  }

  async function reject(w: Worker) {
    if (!confirm(`Reject ${w.name}? Their account will be deactivated and hidden.`)) return
    setSaving(w.id)
    // Soft-delete: mark as inactive and not verified rather than hard deleting.
    // This preserves order history and Aadhaar record for compliance/audit.
    const { error: wErr } = await supabase
      .from('workers')
      .update({ verified: false, is_active: false, is_online: false })
      .eq('id', w.id)
    if (wErr) { toast.error('Failed to reject worker, please try again'); setSaving(null); return }
    // Unlink from any open (non-terminal) orders so they can be reassigned
    const { error: unlinkErr } = await supabase
      .from('orders')
      .update({ worker_id: null, worker_name: null, worker_phone: null })
      .eq('worker_id', w.id)
      .not('status', 'in', '("completed","cancelled")')
    if (unlinkErr) console.error('Failed to unlink open orders:', unlinkErr.message)
    toast.success('Worker rejected and deactivated')
    fetchWorkers()
    setSaving(null)
  }

  async function deactivate(w: Worker) {
    if (!confirm(`Deactivate ${w.name}? They will be removed from the job pool.`)) return
    setSaving(w.id)
    const { error } = await supabase.from('workers').update({ is_active: false, verified: false }).eq('id', w.id)
    if (error) { toast.error('Failed to deactivate worker, please try again'); setSaving(null); return }
    toast.success(`${w.name} deactivated`)
    fetchWorkers()
    setSaving(null)
  }

  // Sort: unverified+active first (oldest waiting at top), then verified, then inactive
  const q = search.toLowerCase().trim()
  const sorted = [...workers]
    .filter(w => !q || [w.name, w.phone, w.service, w.city || ''].some(v => v.toLowerCase().includes(q)))
    .sort((a, b) => {
      const aPending = !a.verified && a.is_active !== false
      const bPending = !b.verified && b.is_active !== false
      if (aPending && !bPending) return -1
      if (!aPending && bPending) return 1
      if (aPending && bPending) return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const pendingCount = workers.filter(w => !w.verified && w.is_active !== false).length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-black font-heading text-slate-50">
          {selectedCity ? `${selectedCity} — Workers` : 'All Workers'}
        </h1>
        {pendingCount > 0 && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400">
            {pendingCount} pending verification
          </span>
        )}
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, phone, service, city…"
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-50 placeholder-slate-600 text-sm outline-none focus:border-blue-500 mb-4"
      />

      {sorted.length === 0 && (
        <div className="text-center py-10 text-slate-500">
          {search ? 'No workers match your search' : `No workers${selectedCity ? ` in ${selectedCity}` : ''} yet`}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {sorted.map(w => {
          const isPending = !w.verified && w.is_active !== false
          const days = isPending ? waitingDays(w.created_at) : 0
          return (
          <Card key={w.id} className={isPending && days >= 2 ? 'border-amber-500/30' : ''}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 bg-slate-700 rounded-full overflow-hidden flex items-center justify-center font-bold text-slate-50 shrink-0">
                  {w.photo_url
                    ? <img src={w.photo_url} alt={w.name} className="w-full h-full object-cover" />
                    : w.name[0]
                  }
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-50 truncate">{w.name}</p>
                    {isPending && days > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${days >= 3 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        waiting {days}d
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-slate-500 text-xs">{w.service} · {w.phone}{w.city ? ` · ${w.city}` : ''}</p>
                    {(() => {
                      const badge = [...MILESTONES].filter(m => m.job <= (jobCounts[w.id] ?? 0)).pop()
                      if (!badge) return null
                      return (
                        <span className="text-xs font-bold" style={{ color: badge.color }}>
                          {badge.icon} {badge.badge}
                        </span>
                      )
                    })()}
                  </div>
                  {(jobCounts[w.id] || earnings[w.id]) ? (
                    <div className="flex gap-3 mt-0.5">
                      {jobCounts[w.id] > 0 && <span className="text-slate-600 text-[10px]">{jobCounts[w.id]} jobs</span>}
                      {earnings[w.id] > 0 && <span className="text-green-600 text-[10px]">₹{earnings[w.id].toLocaleString('en-IN')} paid out</span>}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {w.is_active === false ? (
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-600/40 text-slate-400">
                    Inactive
                  </span>
                ) : (
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    w.verified
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {w.verified ? '✓ Verified' : '⏳ Pending'}
                  </span>
                )}
                <button
                  onClick={() => setExpanded(expanded === w.id ? null : w.id)}
                  className="text-slate-500"
                >
                  {expanded === w.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
            </div>

            {expanded === w.id && (
              <div className="mt-3 border-t border-slate-700 pt-3 flex flex-col gap-3">
                {/* Aadhaar images (new flow) */}
                {(w.aadhaar_front_url || w.aadhaar_back_url) && (
                  <div>
                    <p className="text-slate-400 text-xs mb-2">Aadhaar Documents</p>
                    <div className="flex gap-2">
                      {w.aadhaar_front_url && (
                        <a href={w.aadhaar_front_url} target="_blank" rel="noreferrer" className="flex-1 bg-slate-700 rounded-xl overflow-hidden">
                          <img src={w.aadhaar_front_url} alt="Front" className="w-full h-24 object-cover" />
                          <p className="text-slate-400 text-xs text-center py-1">Front</p>
                        </a>
                      )}
                      {w.aadhaar_back_url && (
                        <a href={w.aadhaar_back_url} target="_blank" rel="noreferrer" className="flex-1 bg-slate-700 rounded-xl overflow-hidden">
                          <img src={w.aadhaar_back_url} alt="Back" className="w-full h-24 object-cover" />
                          <p className="text-slate-400 text-xs text-center py-1">Back</p>
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {/* Aadhaar number (legacy flow) */}
                {w.aadhaar_url && !w.aadhaar_front_url && (
                  <div>
                    <p className="text-slate-400 text-xs mb-1">Aadhaar Number</p>
                    <p className="text-slate-50 font-mono text-lg tracking-widest">
                      {`XXXX XXXX ${w.aadhaar_url.replace(/\s/g, '').slice(-4)}`}
                    </p>
                    <p className="text-slate-600 text-xs mt-1">Only last 4 digits shown for security</p>
                  </div>
                )}
                {/* Earned badges */}
                {(() => {
                  const badges = MILESTONES.filter(m => m.job <= (jobCounts[w.id] ?? 0))
                  return (
                    <div>
                      <p className="text-slate-400 text-xs mb-2">Earned Badges</p>
                      {badges.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {badges.map(m => (
                            <span
                              key={m.job}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                              style={{ background: m.color + '20', color: m.color, border: `1px solid ${m.color}50` }}
                            >
                              {m.icon} {m.badge}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-600 text-xs">No badges earned yet</p>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}

            {!w.verified && w.is_active !== false && (
              <div className="flex gap-2 mt-3">
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  loading={saving === w.id}
                  onClick={() => verify(w)}
                >
                  Verify & Activate ✓
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  className="flex-1"
                  loading={saving === w.id}
                  onClick={() => reject(w)}
                >
                  Reject
                </Button>
              </div>
            )}

            {w.verified && w.is_active !== false && (
              <div className="flex gap-2 mt-3">
                <Button
                  variant="danger"
                  size="sm"
                  className="flex-1"
                  loading={saving === w.id}
                  onClick={() => deactivate(w)}
                >
                  Deactivate
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  className="flex-1"
                  loading={saving === w.id}
                  onClick={() => reject(w)}
                >
                  Delete
                </Button>
              </div>
            )}

            {w.is_active === false && (
              <div className="flex gap-2 mt-3">
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  loading={saving === w.id}
                  onClick={() => verify(w)}
                >
                  Re-Activate
                </Button>
              </div>
            )}
          </Card>
          )
        })}
      </div>

    </div>
  )
}
