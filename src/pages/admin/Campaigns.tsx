import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { SERVICES } from '../../constants'
import { Send, Users, Clock } from 'lucide-react'
import { formatDate } from '../../lib/utils'

interface CampaignLog {
  id: string
  title: string
  body: string
  target_role: string
  target_city: string | null
  target_service: string | null
  sent_count: number
  created_at: string
}

type TargetRole = 'all' | 'customer' | 'worker'

const ROLE_LABELS: Record<TargetRole, string> = {
  all: 'Everyone',
  customer: 'Customers only',
  worker: 'Workers only',
}

export default function AdminCampaigns() {
  const [logs, setLogs] = useState<CampaignLog[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [reachCount, setReachCount] = useState<number | null>(null)
  const [checkingReach, setCheckingReach] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [targetRole, setTargetRole] = useState<TargetRole>('all')
  const [targetCity, setTargetCity] = useState('')
  const [targetService, setTargetService] = useState('')
  const [cities, setCities] = useState<string[]>([])

  useEffect(() => { loadLogs(); loadCities() }, [])

  async function loadLogs() {
    setLoading(true)
    const { data } = await supabase
      .from('campaign_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    setLogs((data as CampaignLog[]) || [])
    setLoading(false)
  }

  async function loadCities() {
    const { data } = await supabase
      .from('service_cities')
      .select('city_name')
      .eq('is_active', true)
      .order('city_name')
    setCities((data || []).map((r: any) => r.city_name))
  }

  const estimateReach = useCallback(async () => {
    setCheckingReach(true)
    let count = 0
    if (targetRole === 'all' || targetRole === 'customer') {
      let q = supabase.from('profiles').select('id', { count: 'exact', head: true })
        .eq('role', 'customer')
        .not('fcm_token', 'is', null)
      const { count: c } = await q
      count += c ?? 0
    }
    if (targetRole === 'all' || targetRole === 'worker') {
      let q = supabase.from('workers').select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .not('fcm_token', 'is', null)
      if (targetCity) q = q.eq('city', targetCity)
      if (targetService) q = q.contains('service_categories', [targetService])
      const { count: c } = await q
      count += c ?? 0
    }
    setReachCount(count)
    setCheckingReach(false)
  }, [targetRole, targetCity, targetService])

  useEffect(() => {
    const t = setTimeout(estimateReach, 400)
    return () => clearTimeout(t)
  }, [estimateReach])

  async function handleSend() {
    if (!title.trim()) return toast.error('Enter a title')
    if (!body.trim()) return toast.error('Enter a message body')

    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('send-campaign', {
        body: {
          title: title.trim(),
          body: body.trim(),
          target_role: targetRole,
          target_city: targetCity || null,
          target_service: targetService || null,
        },
      })
      if (error) throw error
      const sent = data?.sent_count ?? 0
      toast.success(`Campaign sent to ${sent} device${sent !== 1 ? 's' : ''} ✓`)
      setTitle('')
      setBody('')
      setTargetRole('all')
      setTargetCity('')
      setTargetService('')
      loadLogs()
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('Failed to send a request') || msg.includes('EdgeFunction')) {
        toast.error('Edge function not deployed — run: npx supabase functions deploy send-campaign')
      } else {
        toast.error(msg || 'Failed to send campaign')
      }
    }
    setSending(false)
  }

  const charLeft = 120 - body.length

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-black font-heading text-slate-50">Campaigns</h1>
        <p className="text-slate-400 text-sm mt-0.5">Send push notifications to users</p>
      </div>

      {/* Compose card */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-5">
        <p className="text-slate-50 font-bold text-sm mb-4">New Campaign</p>

        <div className="flex flex-col gap-3">
          {/* Title */}
          <div>
            <label className="text-slate-400 text-xs font-medium block mb-1">Notification Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Special offer this weekend!"
              maxLength={60}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-50 placeholder-slate-500 outline-none focus:border-blue-500 text-sm"
            />
          </div>

          {/* Body */}
          <div>
            <label className="text-slate-400 text-xs font-medium block mb-1">
              Message <span className={`${charLeft < 20 ? 'text-red-400' : 'text-slate-600'}`}>{charLeft} chars left</span>
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value.slice(0, 120))}
              placeholder="e.g. Book today and get ₹50 off on your first order!"
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-50 placeholder-slate-500 outline-none focus:border-blue-500 resize-none text-sm"
            />
          </div>

          {/* Target audience */}
          <div>
            <label className="text-slate-400 text-xs font-medium block mb-2">Target Audience</label>
            <div className="flex gap-2 flex-wrap">
              {(Object.entries(ROLE_LABELS) as [TargetRole, string][]).map(([role, label]) => (
                <button
                  key={role}
                  onClick={() => { setTargetRole(role); setTargetCity(''); setTargetService('') }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    targetRole === role
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* City filter (workers + all) */}
          {(targetRole === 'worker' || targetRole === 'all') && (
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1">Filter by City (optional)</label>
              <select
                value={targetCity}
                onChange={e => setTargetCity(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-50 outline-none focus:border-blue-500 text-sm"
              >
                <option value="">All cities</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* Service filter (workers only) */}
          {targetRole === 'worker' && (
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1">Filter by Service (optional)</label>
              <select
                value={targetService}
                onChange={e => setTargetService(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-50 outline-none focus:border-blue-500 text-sm"
              >
                <option value="">All services</option>
                {SERVICES.map(s => <option key={s.name} value={s.name}>{s.emoji} {s.name}</option>)}
              </select>
            </div>
          )}

          {/* Reach estimate + send */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs">
              <Users size={13} />
              {checkingReach
                ? 'Estimating reach…'
                : reachCount != null
                  ? `~${reachCount} device${reachCount !== 1 ? 's' : ''} will receive this`
                  : ''}
            </div>
            <button
              onClick={handleSend}
              disabled={sending || !title.trim() || !body.trim()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              <Send size={15} />
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="mb-3 flex items-center gap-2">
        <Clock size={14} className="text-slate-500" />
        <p className="text-slate-400 text-sm font-semibold">Recent Campaigns</p>
      </div>

      {loading ? (
        <p className="text-slate-500 text-xs text-center py-8">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="text-slate-600 text-xs text-center py-8">No campaigns sent yet</p>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map(log => (
            <div key={log.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-slate-200 text-sm font-semibold truncate">{log.title}</p>
                  <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">{log.body}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="bg-blue-500/15 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {ROLE_LABELS[log.target_role as TargetRole] ?? log.target_role}
                    </span>
                    {log.target_city && (
                      <span className="bg-slate-700 text-slate-400 text-[10px] px-2 py-0.5 rounded-full">{log.target_city}</span>
                    )}
                    {log.target_service && (
                      <span className="bg-slate-700 text-slate-400 text-[10px] px-2 py-0.5 rounded-full">{log.target_service}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-slate-50 text-sm font-black">{log.sent_count}</p>
                  <p className="text-slate-500 text-[10px]">sent</p>
                </div>
              </div>
              <p className="text-slate-600 text-[10px] mt-2">{formatDate(log.created_at)}</p>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
