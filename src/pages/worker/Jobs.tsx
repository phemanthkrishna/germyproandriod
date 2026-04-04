import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../../context/AuthContext'
import { useOrders } from '../../hooks/useOrders'
import { supabase } from '../../lib/supabase'
import { StatusBadge } from '../../components/StatusBadge'
import { BottomNav } from '../../components/BottomNav'
import { ThemeToggle } from '../../components/ThemeToggle'
import { BadgeUnlockOverlay } from '../../components/BadgeUnlockOverlay'
import { useWorkerProgress } from '../../hooks/useWorkerProgress'
import { formatDate, formatCurrency } from '../../lib/utils'
import { Briefcase, DollarSign, User, History, Trophy } from 'lucide-react'
import type { Worker, Order } from '../../types'

const NAV = [
  { to: '/worker',          icon: Briefcase,  label: 'Jobs'     },
  { to: '/worker/progress', icon: Trophy,     label: 'Progress', activeColor: '#F47820' },
  { to: '/worker/earnings', icon: DollarSign, label: 'Earnings' },
  { to: '/worker/history',  icon: History,    label: 'History'  },
  { to: '/worker/profile',  icon: User,       label: 'Profile'  },
]

export default function WorkerJobs() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [workerInfo, setWorkerInfo] = useState<Worker | null>(null)

  const { orders: myJobs } = useOrders({ worker_id: session?.id || '' })
  const activeJobs = myJobs.filter(o => !['completed', 'cancelled'].includes(o.status))
  const isBusyOnJob = activeJobs.some(o => o.worker_id === session?.id && !['completed', 'cancelled'].includes(o.status))
  const totalEarned = myJobs
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + (o.quote_labour || 0), 0)

  const [available, setAvailable] = useState<typeof myJobs>([])

  // Progress data for mini bar + badge unlock overlay
  const {
    completedJobs,
    currentBadge,
    nextMilestone,
    progressToNext,
    justUnlocked,
    clearJustUnlocked,
  } = useWorkerProgress(session?.id ?? '')

  const [barAnimated, setBarAnimated] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setBarAnimated(true), 300)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    supabase
      .from('workers')
      .select('*')
      .eq('id', session?.id)
      .single()
      .then(({ data }) => setWorkerInfo(data))

    fetchAvailable()

    const channel = supabase
      .channel('available-jobs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => fetchAvailable())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => fetchAvailable())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workers' }, () => fetchAvailable())
      .subscribe(status => {
        // Reconnect if the channel drops
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setTimeout(() => fetchAvailable(), 3000)
        }
      })
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchAvailable() {
    // Fetch all unassigned booked orders first
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'booked')
      .is('worker_id', null)
      .order('created_at', { ascending: false })

    const all = (orders as Order[]) || []

    // Collect preferred_worker_ids that need an availability check
    const preferredIds = [...new Set(
      all.map(o => o.preferred_worker_id).filter((id): id is string => !!id && id !== session?.id)
    )]

    let unavailable = new Set<string>()
    if (preferredIds.length > 0) {
      // A preferred worker is "unavailable" if offline OR has an active job
      const [offlineRes, busyRes] = await Promise.all([
        supabase.from('workers').select('id').in('id', preferredIds).eq('is_online', false),
        supabase.from('orders').select('worker_id')
          .in('worker_id', preferredIds)
          .not('status', 'in', '(completed,cancelled)'),
      ])
      unavailable = new Set<string>([
        ...((offlineRes.data || []).map((w: { id: string }) => w.id)),
        ...((busyRes.data || []).map((o: { worker_id: string }) => o.worker_id).filter(Boolean)),
      ])
    }

    // Show job if: no preferred worker, I'm the preferred worker, or preferred worker is unavailable
    const visible = all.filter(o =>
      !o.preferred_worker_id ||
      o.preferred_worker_id === session?.id ||
      unavailable.has(o.preferred_worker_id)
    )
    setAvailable(visible)
  }

  async function toggleOnline() {
    if (!workerInfo) return
    const newVal = !workerInfo.is_online
    const update: Record<string, unknown> = {
      is_online: newVal,
      last_active_at: new Date().toISOString(),
    }
    // Going online resets the offline timer
    if (newVal) update.went_offline_at = null
    else update.went_offline_at = new Date().toISOString()

    const { error } = await supabase.from('workers').update(update).eq('id', workerInfo.id)
    if (error) { toast.error(error.message); return }
    setWorkerInfo(w => w ? { ...w, is_online: newVal } : w)
    toast.success(newVal ? 'You are now Online' : 'You are now Offline')
  }

  const filteredAvailable = available.filter(o => {
    const cats = workerInfo?.service_categories
    if (!cats || cats.length === 0) return true
    return cats.includes(o.service)
  })

  const isVerified = workerInfo?.verified ?? false

  return (
    <div className="page-content px-5 py-6">

      {/* Badge unlock overlay */}
      {justUnlocked && (
        <BadgeUnlockOverlay
          milestone={justUnlocked}
          completedJobs={completedJobs}
          onClose={clearJustUnlocked}
        />
      )}

      {/* Pending verification banner */}
      {workerInfo && !isVerified && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4">
          <p className="text-amber-400 font-bold text-sm mb-1">⏳ Verification Pending</p>
          <p className="text-amber-400/80 text-xs leading-relaxed">
            Our admin team is reviewing your Aadhaar and profile photo. You'll be able to accept jobs as soon as you're approved — usually within 24 hours.
          </p>
        </div>
      )}

      {/* Offline banner */}
      {workerInfo && isVerified && !workerInfo.is_online && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-4">
          <p className="text-[var(--text)] font-bold text-sm mb-1">You're Offline</p>
          <p className="text-[var(--muted)] text-xs mb-3">Tap the Online button above to start receiving job requests in your area.</p>
          <button
            onClick={toggleOnline}
            className="w-full bg-green-500 text-white font-bold text-sm rounded-xl py-2.5"
          >
            Go Online Now
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0 mr-3">
            <p className="text-slate-400 text-sm">Welcome back,</p>
            <h1 className="text-2xl font-black font-heading text-slate-50 truncate">{session?.name?.split(' ')[0]}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            {workerInfo && (
              <button
                onClick={toggleOnline}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                  workerInfo.is_online
                    ? 'bg-green-500/20 border-green-500/40 text-green-400'
                    : 'bg-slate-700 border-slate-600 text-slate-400'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${workerInfo.is_online ? 'bg-green-400' : 'bg-slate-500'}`} />
                {workerInfo.is_online ? 'Online' : 'Offline'}
              </button>
            )}
          </div>
        </div>
        <div className="flex justify-end mt-1">
          <div className="text-right">
            <p className="text-slate-500 text-xs">Total Earned</p>
            <p className="text-green-400 font-black text-lg">{formatCurrency(totalEarned)}</p>
          </div>
        </div>
      </div>

      {/* ── Mini Progress Bar ──────────────────────────────────────── */}
      <button
        onClick={() => navigate('/worker/progress')}
        className="-mx-5 mb-4 flex items-center gap-2 px-5 w-[calc(100%+40px)] text-left h-12 bg-[#E85520]/10 border-b border-[#E85520]/20"
      >
        <span className="text-xl shrink-0">{currentBadge?.icon ?? '🔧'}</span>
        <span className="text-xs font-bold text-[#E85520] shrink-0 whitespace-nowrap">
          {currentBadge?.badge ?? 'Start!'}
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden mx-1">
          <div
            className="h-full rounded-full bg-[#E85520] transition-all duration-1000 ease-out"
            style={{ width: barAnimated ? `${progressToNext}%` : '0%', minWidth: progressToNext > 0 ? 4 : 0 }}
          />
        </div>
        {nextMilestone ? (
          <span className="text-[11px] font-bold text-[#E85520] shrink-0 whitespace-nowrap">
            {nextMilestone.job - completedJobs} to {nextMilestone.badge} →
          </span>
        ) : (
          <span className="text-[11px] font-bold text-purple-400 shrink-0">
            👑 Legend!
          </span>
        )}
      </button>

      {/* My Active Jobs */}
      {activeJobs.length > 0 && (
        <>
          <h2 className="text-base font-bold text-slate-300 mb-3">My Active Jobs</h2>
          <div className="flex flex-col gap-3 mb-6">
            {activeJobs.map(o => (
              <JobCard key={o.id} order={o} onClick={() => navigate(`/worker/job/${o.id}`)} />
            ))}
          </div>
        </>
      )}

      {/* Busy banner */}
      {isBusyOnJob && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 mb-4 text-orange-400 text-sm">
          🔒 You're currently on a job — complete it before accepting new requests
        </div>
      )}

      {/* Available Jobs */}
      {isVerified && workerInfo?.is_online && !isBusyOnJob && (() => {
        const requestedJobs = filteredAvailable.filter(o => o.preferred_worker_id === session?.id)
        const generalJobs   = filteredAvailable.filter(o => !o.preferred_worker_id)
        return (
          <>
            {requestedJobs.length > 0 && (
              <>
                <h2 className="text-base font-bold text-orange-400 mb-3">🎯 Requested for You</h2>
                <div className="flex flex-col gap-3 mb-5">
                  {requestedJobs.map(o => (
                    <JobCard key={o.id} order={o} requested onClick={() => navigate(`/worker/job/${o.id}`)} />
                  ))}
                </div>
              </>
            )}
            <h2 className="text-base font-bold text-slate-300 mb-3">Available Jobs</h2>
            {generalJobs.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-slate-500">No jobs available right now</p>
                <p className="text-slate-600 text-xs mt-1">Check back soon</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {generalJobs.map(o => (
                  <JobCard key={o.id} order={o} onClick={() => navigate(`/worker/job/${o.id}`)} />
                ))}
              </div>
            )}
          </>
        )
      })()}

      <BottomNav items={NAV} />
    </div>
  )
}

function JobCard({ order, onClick, requested }: { order: Order; onClick: () => void; requested?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`border rounded-2xl p-4 text-left btn-press w-full ${
        requested
          ? 'bg-orange-500/10 border-orange-500/40'
          : 'bg-slate-800 border-slate-700'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl shrink-0">{order.service_emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-50 truncate">{order.service}</p>
          <p className="text-slate-500 text-xs truncate">{order.address}</p>
          <p className="text-slate-600 text-xs mt-0.5">{formatDate(order.created_at)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>
    </button>
  )
}
