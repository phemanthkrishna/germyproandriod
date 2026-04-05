import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { haversineDistance } from '../lib/utils'
import type { Order } from '../types'

const TIMEOUT_SECS = 30
const SWIPE_THRESHOLD = 80
const RADIUS_1KM = 1
const RADIUS_5KM = 5
const EXPAND_DELAY_MS = 45_000  // 45s delay before showing to 1–5km workers

interface WorkerMeta {
  service_categories: string[]
  is_online: boolean
  verified: boolean
  is_active: boolean
}

interface Props {
  workerId: string
  workerName: string
  workerPhone: string
}

export function JobCallScreen({ workerId, workerName, workerPhone }: Props) {
  const [workerMeta, setWorkerMeta] = useState<WorkerMeta | null>(null)
  const [queue, setQueue] = useState<Order[]>([])
  const [countdown, setCountdown] = useState(TIMEOUT_SECS)
  const [accepting, setAccepting] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [settling, setSettling] = useState(false)
  const navigate = useNavigate()
  const currentRef = useRef<Order | null>(null)
  const touchStartX = useRef(0)
  const dragActiveRef = useRef(false)
  const workerPosRef = useRef<{ lat: number; lng: number } | null>(null)
  const pendingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Lock body scroll while screen is visible
  useEffect(() => {
    if (queue.length > 0) {
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
    } else {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
    }
  }, [queue.length])

  // ── Load and watch worker meta ──────────────────────────────────────
  useEffect(() => {
    supabase.from('workers')
      .select('service_categories, is_online, verified, is_active')
      .eq('id', workerId)
      .single()
      .then(({ data, error }) => { if (!error && data) setWorkerMeta(data as WorkerMeta) })

    const ch = supabase.channel(`worker-meta-${workerId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'workers',
        filter: `id=eq.${workerId}`,
      }, payload => setWorkerMeta(payload.new as WorkerMeta))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [workerId])

  // ── When meta changes, clear queue if no longer eligible ────────────
  useEffect(() => {
    if (!workerMeta) return
    const eligible = workerMeta.verified && workerMeta.is_active && workerMeta.is_online
    if (!eligible) { setQueue([]); return }
    loadPendingOrders(workerMeta)
  }, [workerMeta])

  // ── Keep worker position updated ────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      pos => { workerPosRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude } },
      () => {},
      { enableHighAccuracy: true }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // ── Queue order based on distance (1km now, 1–5km after 45s) ────────
  function enqueueWithRadius(order: Order) {
    const addToQueue = () => setQueue(prev => prev.find(o => o.id === order.id) ? prev : [...prev, order])

    if (!order.customer_lat || !order.customer_lng || !workerPosRef.current) {
      if ('vibrate' in navigator) navigator.vibrate([400, 150, 400, 150, 400])
      addToQueue()
      return
    }

    const dist = haversineDistance(
      workerPosRef.current.lat, workerPosRef.current.lng,
      order.customer_lat, order.customer_lng
    )

    if (dist <= RADIUS_1KM) {
      if ('vibrate' in navigator) navigator.vibrate([400, 150, 400, 150, 400])
      addToQueue()
    } else if (dist <= RADIUS_5KM) {
      const timer = setTimeout(async () => {
        pendingTimers.current.delete(order.id)
        const { data } = await supabase.from('orders').select('worker_id').eq('id', order.id).single()
        if (!data?.worker_id) {
          if ('vibrate' in navigator) navigator.vibrate([400, 150, 400])
          addToQueue()
        }
      }, EXPAND_DELAY_MS)
      pendingTimers.current.set(order.id, timer)
    }
    // > 5km: silently ignore
  }

  async function isBusy(): Promise<boolean> {
    const { data } = await supabase
      .from('orders')
      .select('id')
      .eq('worker_id', workerId)
      .not('status', 'in', '(completed,cancelled)')
      .limit(1)
    return (data?.length ?? 0) > 0
  }

  async function loadPendingOrders(meta: WorkerMeta) {
    if (await isBusy()) return
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'booked')
      .eq('booking_paid', true)
      .is('worker_id', null)
      .not('declined_worker_ids', 'cs', `{${workerId}}`)
      .or(`preferred_worker_id.is.null,preferred_worker_id.eq.${workerId}`)
      .order('created_at', { ascending: true })
    const cats = meta.service_categories || []
    const now = Date.now()
    const relevant = ((data || []) as Order[]).filter(o => {
      if (cats.length > 0 && !cats.includes(o.service)) return false
      if (!o.customer_lat || !o.customer_lng || !workerPosRef.current) return true
      const dist = haversineDistance(
        workerPosRef.current.lat, workerPosRef.current.lng,
        o.customer_lat, o.customer_lng
      )
      if (dist <= RADIUS_1KM) return true
      if (dist <= RADIUS_5KM) return (now - new Date(o.created_at).getTime()) >= EXPAND_DELAY_MS
      return false
    })
    setQueue(relevant)
  }

  // ── Subscribe to incoming orders ────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`job-requests-${workerId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, async payload => {
        // Ignore unpaid orders — wait for booking_paid UPDATE instead
        const order = payload.new as Order
        if (!order.booking_paid) return
        if (!workerMeta?.verified || !workerMeta?.is_active || !workerMeta?.is_online) return
        if (order.status !== 'booked' || order.worker_id) return
        if ((order.declined_worker_ids || []).includes(workerId)) return
        if (order.preferred_worker_id && order.preferred_worker_id !== workerId) return
        const cats = workerMeta.service_categories || []
        if (cats.length > 0 && !cats.includes(order.service)) return
        if (await isBusy()) return
        enqueueWithRadius(order)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, async payload => {
        const updated = payload.new as Order
        const old     = payload.old as Order

        // Payment just confirmed → show job card to eligible workers
        if (!old.booking_paid && updated.booking_paid && updated.status === 'booked' && !updated.worker_id) {
          if (!workerMeta?.verified || !workerMeta?.is_active || !workerMeta?.is_online) return
          if ((updated.declined_worker_ids || []).includes(workerId)) return
          if (updated.preferred_worker_id && updated.preferred_worker_id !== workerId) return
          const cats = workerMeta.service_categories || []
          if (cats.length > 0 && !cats.includes(updated.service)) return
          if (await isBusy()) return
          enqueueWithRadius(updated)
          return
        }

        // Job taken by another worker — remove from queue
        if (updated.worker_id && updated.worker_id !== workerId) {
          const timer = pendingTimers.current.get(updated.id)
          if (timer) { clearTimeout(timer); pendingTimers.current.delete(updated.id) }
          setQueue(prev => prev.filter(o => o.id !== updated.id))
        }
      })
      .subscribe()

    // Separate shared broadcast channel — preferred worker sends here on decline
    // This bypasses RLS so ALL online workers reliably receive the notification
    const broadcastCh = supabase.channel('job-pool')
      .on('broadcast', { event: 'job_released' }, async () => {
        if (!workerMeta?.verified || !workerMeta?.is_active || !workerMeta?.is_online) return
        if (await isBusy()) return
        loadPendingOrders(workerMeta)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
      supabase.removeChannel(broadcastCh)
      pendingTimers.current.forEach(t => clearTimeout(t))
      pendingTimers.current.clear()
    }
  }, [workerId, workerMeta])

  const current = queue[0] ?? null
  currentRef.current = current

  // ── Countdown timer per order ───────────────────────────────────────
  useEffect(() => {
    if (!current) return
    setCountdown(TIMEOUT_SECS)

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          const ord = currentRef.current
          if (ord) doDecline(ord)
          return TIMEOUT_SECS
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [current?.id])

  // ── Actions ─────────────────────────────────────────────────────────
  async function doDecline(order: Order) {
    if (order.preferred_worker_id === workerId) {
      // Single atomic update: clear preferred window + mark us declined
      const { error } = await supabase.from('orders').update({
        preferred_worker_id: null,
        declined_worker_ids: [...(order.declined_worker_ids || []), workerId],
      }).eq('id', order.id)
      if (error) console.error('decline preferred job failed:', error.message)
      // Broadcast to all workers via shared channel — bypasses RLS, guaranteed delivery
      supabase.channel('job-pool').send({
        type: 'broadcast',
        event: 'job_released',
        payload: { order_id: order.id },
      })
    } else {
      const { error } = await supabase.rpc('decline_job', { p_order_id: order.id, p_worker_id: workerId })
      if (error) console.error('decline_job failed:', error.message)
    }
    setQueue(prev => prev.filter(o => o.id !== order.id))
  }

  async function handleAccept() {
    if (!current || accepting) return
    setAccepting(true)

    const { data, error } = await supabase
      .from('orders')
      .update({ worker_id: workerId, worker_name: workerName, worker_phone: workerPhone })
      .eq('id', current.id)
      .is('worker_id', null)
      .select('id')

    if (error || !data?.length) {
      toast.error('Job was just taken by another pro')
      setQueue(prev => prev.filter(o => o.id !== current.id))
      setAccepting(false)
      return
    }

    toast.success('Job accepted! 🎉')
    setQueue([])
    navigate(`/worker/job/${current.id}`)
    setAccepting(false)
  }

  async function handleDecline() {
    if (!current) return
    await doDecline(current)
  }

  // ── Swipe handlers ───────────────────────────────────────────────────
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    dragActiveRef.current = true
    setSettling(false)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragActiveRef.current) return
    const dx = e.touches[0].clientX - touchStartX.current
    setDragX(dx)
  }

  function onTouchEnd() {
    dragActiveRef.current = false
    const dx = dragX
    setSettling(true)
    setDragX(0)
    if (dx > SWIPE_THRESHOLD) handleAccept()
    else if (dx < -SWIPE_THRESHOLD) handleDecline()
  }

  if (!current) return null

  const swipeProgress = Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1)
  const swipingRight = dragX > 15
  const swipingLeft = dragX < -15
  const urgent = countdown <= 8
  const timerPct = (countdown / TIMEOUT_SECS) * 100

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col overflow-hidden select-none touch-none">

      {/* Background color wash on swipe */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: swipingRight
            ? `rgba(34,197,94,${swipeProgress * 0.18})`
            : swipingLeft
            ? `rgba(239,68,68,${swipeProgress * 0.18})`
            : 'transparent',
          transition: dragActiveRef.current ? 'none' : 'background 0.3s ease',
        }}
      />

      {/* Countdown bar */}
      <div className="w-full h-1.5 bg-slate-800 shrink-0">
        <div
          className={`h-full ${urgent ? 'bg-red-500' : 'bg-orange-500'}`}
          style={{ width: `${timerPct}%`, transition: 'width 1s linear' }}
        />
      </div>

      {/* Header */}
      <div className="px-6 pt-5 text-center shrink-0">
        <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-3">
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          <span className="text-orange-400 text-xs font-bold uppercase tracking-widest">Incoming Job</span>
        </div>
        <p className={`text-sm font-bold ${urgent ? 'text-red-400' : 'text-slate-500'}`}>
          {urgent ? `⚠️ Auto-declining in ${countdown}s` : `${countdown}s to respond`}
        </p>
        {queue.length > 1 && (
          <p className="text-slate-600 text-xs mt-1">{queue.length - 1} more in queue</p>
        )}
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center px-5 relative overflow-hidden">

        {/* Decline indicator */}
        <div
          className="absolute left-4 z-10 flex flex-col items-center gap-2 pointer-events-none"
          style={{ opacity: swipingLeft ? swipeProgress : 0.12, transition: 'opacity 0.1s' }}
        >
          <div
            className="w-16 h-16 rounded-full border-2 border-red-500 bg-red-500/20 flex items-center justify-center"
            style={{ transform: `scale(${0.7 + swipeProgress * 0.4})` }}
          >
            <span className="text-red-400 text-3xl font-black leading-none">✕</span>
          </div>
          <span className="text-red-400 text-xs font-black tracking-wider">DECLINE</span>
        </div>

        {/* Accept indicator */}
        <div
          className="absolute right-4 z-10 flex flex-col items-center gap-2 pointer-events-none"
          style={{ opacity: swipingRight ? swipeProgress : 0.12, transition: 'opacity 0.1s' }}
        >
          <div
            className="w-16 h-16 rounded-full border-2 border-green-500 bg-green-500/20 flex items-center justify-center"
            style={{ transform: `scale(${0.7 + swipeProgress * 0.4})` }}
          >
            <span className="text-green-400 text-3xl font-black leading-none">✓</span>
          </div>
          <span className="text-green-400 text-xs font-black tracking-wider">ACCEPT</span>
        </div>

        {/* Swipeable card */}
        <div
          className="w-full rounded-3xl overflow-hidden"
          style={{
            transform: `translateX(${dragX}px) rotate(${dragX * 0.025}deg)`,
            transition: settling && !dragActiveRef.current ? 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
            boxShadow: swipingRight
              ? `0 8px 60px rgba(34,197,94,${swipeProgress * 0.5}), 0 2px 20px rgba(0,0,0,0.6)`
              : swipingLeft
              ? `0 8px 60px rgba(239,68,68,${swipeProgress * 0.5}), 0 2px 20px rgba(0,0,0,0.6)`
              : '0 8px 40px rgba(0,0,0,0.6)',
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Card gradient top */}
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700/60 rounded-3xl">

            {/* Emoji section */}
            <div className="pt-8 pb-5 flex flex-col items-center gap-1">
              <div className="w-28 h-28 rounded-3xl bg-slate-700/60 flex items-center justify-center shadow-inner mb-2">
                <span className="text-7xl">{current.service_emoji}</span>
              </div>
              <h2 className="text-white font-black text-3xl text-center">{current.service}</h2>
            </div>

            {/* Divider */}
            <div className="h-px bg-slate-700/50 mx-5" />

            {/* Details */}
            <div className="px-6 py-5 flex flex-col gap-3">
              {/* Address */}
              <div className="flex items-start gap-3">
                <span className="text-slate-500 text-lg mt-0.5">📍</span>
                <p className="text-slate-300 text-sm leading-relaxed flex-1">{current.address}</p>
              </div>

              {/* Earnings */}
              <div className="flex items-center gap-3">
                <span className="text-slate-500 text-lg">💰</span>
                <div>
                  <p className="text-green-400 font-black text-lg leading-tight">₹100 guaranteed</p>
                  <p className="text-slate-500 text-xs">Visit charge · paid upfront</p>
                </div>
              </div>
            </div>

            {/* Swipe hint */}
            <div className="px-6 pb-6">
              <div className="flex items-center justify-between text-slate-600">
                <div className="flex items-center gap-1.5">
                  <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                    <path d="M7 1L1 7L7 13M1 7H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-xs font-semibold">Decline</span>
                </div>
                <div className="flex items-center gap-1 opacity-40">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold">Accept</span>
                  <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                    <path d="M11 1L17 7L11 13M17 7H1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tap buttons (fallback for non-swipe) */}
      <div className="px-5 pb-10 pt-4 flex gap-3 shrink-0">
        <button
          onTouchEnd={e => { e.preventDefault(); handleDecline() }}
          onClick={handleDecline}
          className="flex-1 py-4 rounded-2xl bg-slate-800 border border-slate-700 active:bg-red-500/20 active:border-red-500/40 transition-colors"
        >
          <span className="text-[var(--text)] font-bold text-base">✕  Decline</span>
        </button>
        <button
          onTouchEnd={e => { e.preventDefault(); if (!accepting) handleAccept() }}
          onClick={handleAccept}
          disabled={accepting}
          className="flex-1 py-4 rounded-2xl bg-green-500 active:bg-green-600 transition-colors disabled:opacity-60"
        >
          <span className="text-white font-bold text-base">
            {accepting ? '⏳  Accepting...' : '✓  Accept'}
          </span>
        </button>
      </div>
    </div>
  )
}
