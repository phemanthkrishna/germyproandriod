import { useState, useEffect, Component, Suspense, lazy, type ReactNode } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useOrder } from '../../hooks/useOrders'
import { StatusBadge } from '../../components/StatusBadge'
import { JourneyTracker } from '../../components/JourneyTracker'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'

// Lazy-load LiveTrackingMap so import-time errors don't crash the page
const LiveTrackingMap = lazy(() =>
  import('../../components/LiveTrackingMap').then(m => ({ default: m.LiveTrackingMap }))
    .catch(err => {
      console.error('Failed to load LiveTrackingMap:', err)
      return { default: () => <div className="bg-slate-800 rounded-xl p-4 text-center"><p className="text-slate-400 text-sm">Live tracking unavailable</p></div> }
    })
)

// Error boundary to prevent LiveTrackingMap runtime crashes from blanking the page
class MapErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err: Error) { console.error('LiveTrackingMap error:', err) }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-slate-800 rounded-xl p-4 text-center">
          <p className="text-slate-400 text-sm">Live tracking unavailable</p>
        </div>
      )
    }
    return this.props.children
  }
}
import { supabase } from '../../lib/supabase'
import { formatDate, formatCurrency } from '../../lib/utils'
import { TRANSACTION_FEE_RATE, PACKAGE_SERVICES, AC_ADVANCE } from '../../constants'
import { ArrowLeft, Star, Phone } from 'lucide-react'
import { MILESTONES } from '../../hooks/useWorkerProgress'
import type { Milestone } from '../../hooks/useWorkerProgress'

// Per-step summary shown in the first card
const STEP_SUMMARY: Record<string, { icon: string; title: string; desc: string; color: string; bg: string }> = {
  booked_searching: {
    icon: '🔍', title: 'Finding your Pro',
    desc: 'We\'re matching the best professional near you',
    color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)',
  },
  booked_assigned: {
    icon: '🚗', title: 'Pro is on the way',
    desc: 'Your Pro accepted the job and is heading to you — share the Arrival OTP when they arrive',
    color: '#F59E0B', bg: 'rgba(245,158,11,0.08)',
  },
  worker_visiting: {
    icon: '🚗', title: 'Pro has arrived',
    desc: 'Your Pro is at the door',
    color: '#F59E0B', bg: 'rgba(245,158,11,0.08)',
  },
  inspecting: {
    icon: '🔍', title: 'Inspection in progress',
    desc: 'Your Pro is assessing the work needed before sending a quote',
    color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)',
  },
  quote_sent_pending: {
    icon: '⏳', title: 'Quote being prepared',
    desc: 'Our store partner is pricing the materials — your quote will appear here shortly',
    color: '#3B82F6', bg: 'rgba(59,130,246,0.08)',
  },
  quote_sent_ready: {
    icon: '📋', title: 'Quote ready!',
    desc: 'Review the quote below and submit payment to begin work',
    color: '#3B82F6', bg: 'rgba(59,130,246,0.08)',
  },
  in_progress: {
    icon: '🔧', title: 'Work in progress',
    desc: 'Your Pro is collecting materials and will start work shortly',
    color: '#F97316', bg: 'rgba(249,115,22,0.08)',
  },
  material_collected: {
    icon: '🏪', title: 'Materials collected',
    desc: 'Your Pro has collected all materials and is working on the job now',
    color: '#F97316', bg: 'rgba(249,115,22,0.08)',
  },
  done_uploaded: {
    icon: '📸', title: 'Almost done!',
    desc: 'Share the Completion OTP below with your Pro to confirm the job is finished',
    color: '#10B981', bg: 'rgba(16,185,129,0.08)',
  },
  completed: {
    icon: '🎉', title: 'Job Complete!',
    desc: 'Your service has been completed successfully. Thank you for using GetMyPro!',
    color: '#10B981', bg: 'rgba(16,185,129,0.08)',
  },
  cancelled: {
    icon: '❌', title: 'Order Cancelled',
    desc: 'This order has been cancelled',
    color: '#EF4444', bg: 'rgba(239,68,68,0.08)',
  },
}

function getSummaryKey(status: string, workerId?: string | null, matCostAdmin?: number | null): string {
  if (status === 'booked') return workerId ? 'booked_assigned' : 'booked_searching'
  if (status === 'quote_sent') return matCostAdmin != null ? 'quote_sent_ready' : 'quote_sent_pending'
  return status
}

export default function CustomerOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>()
  const { order, loading, refetch } = useOrder(orderId!)
  const [rating, setRating] = useState(0)
  const [saving, setSaving] = useState(false)
  const [workerPhoto, setWorkerPhoto] = useState<string | null>(null)
  const [workerBadge, setWorkerBadge] = useState<Milestone | null>(null)
  const [showRatingPopup, setShowRatingPopup] = useState(false)
  const [hoverRating, setHoverRating] = useState(0)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Auto-open rating popup when order completes and hasn't been rated
  useEffect(() => {
    if (order?.status === 'completed' && !order.rating) {
      setShowRatingPopup(true)
    }
  }, [order?.status, order?.rating])

  useEffect(() => {
    if (!order?.worker_id) return
    const wid = order.worker_id

    async function loadWorkerData() {
      const [workerRes, countRes] = await Promise.all([
        supabase.from('workers').select('photo_url').eq('id', wid).maybeSingle(),
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .eq('worker_id', wid).eq('status', 'completed'),
      ])
      if (!workerRes.error) setWorkerPhoto(workerRes.data?.photo_url || null)
      const n = countRes.count ?? 0
      const badge = [...MILESTONES].filter(m => m.job <= n).pop() ?? null
      setWorkerBadge(badge)
    }

    loadWorkerData()
  }, [order?.worker_id])

  // Show toast when returning from Cashfree redirect
  // We check the DB rather than the URL param — Cashfree sandbox doesn't always
  // replace {order_status} reliably, so the URL param is not trustworthy.
  useEffect(() => {
    const paymentParam = searchParams.get('payment')
    const statusParam  = searchParams.get('status')
    if (!paymentParam || !statusParam) return

    // Poll DB for up to 5s waiting for webhook to confirm payment
    let attempts = 0
    const check = setInterval(async () => {
      attempts++
      const { data } = await supabase
        .from('orders')
        .select('booking_paid, final_paid')
        .eq('id', orderId!)
        .single()

      const paid = paymentParam === 'booking' ? data?.booking_paid : data?.final_paid

      if (paid) {
        clearInterval(check)
        toast.success(paymentParam === 'booking'
          ? 'Booking payment successful!'
          : 'Payment successful! Work will begin shortly.')
        refetch()
      } else if (attempts >= 5) {
        clearInterval(check)
        // Cashfree URL status PAID means it went through — webhook may be slightly delayed
        if (statusParam === 'PAID') {
          toast.success(paymentParam === 'booking'
            ? 'Booking payment received — confirming...'
            : 'Payment received — confirming...')
          refetch()
        } else if (statusParam !== 'ACTIVE') {
          toast.error('Payment was not completed. Please try again.')
        }
      }
    }, 1000)

    return () => clearInterval(check)
  }, [])

  async function handleFinalPay() {
    if (!order) return
    if (!order.total_quote) return toast.error('Quote amount not available yet')
    setSaving(true)
    try {
      // TODO: Re-enable Cashfree checkout once Play Store link is whitelisted
      // await openCashfreeCheckout(order.id, 'final')
      // For now, mark final payment as done and move to in_progress (worker starts work)
      await supabase.from('orders').update({ final_paid: true, status: 'in_progress' }).eq('id', order.id)
      toast.success('Payment successful! Work will begin shortly.')
      refetch()
    } catch (err: any) {
      console.error('Final pay failed:', err)
      toast.error(err?.message || 'Failed to process payment, please try again')
    }
    setSaving(false)
  }

  // AC Service: pay the remaining balance after the service is done
  async function handleRemainingPay() {
    if (!order) return
    setSaving(true)
    try {
      await supabase.from('orders').update({ ac_remaining_paid: true, final_paid: true }).eq('id', order.id)
      toast.success('Payment successful! Thank you.')
      refetch()
    } catch (err: any) {
      console.error('Remaining pay failed:', err)
      toast.error(err?.message || 'Failed to process payment, please try again')
    }
    setSaving(false)
  }

  async function cancelOrder() {
    if (!order) return
    if (order.status === 'cancelled') return
    if (!confirm('Cancel this order? The worker has already visited, so ₹100 of your booking fee will go to the Pro.')) return
    setSaving(true)
    try {
      const workerVisited = ['inspecting', 'quote_sent', 'in_progress', 'done_uploaded', 'worker_visiting'].includes(order.status)
      const { error } = await supabase.from('orders').update({
        status: 'cancelled',
        worker_cancellation_pay: workerVisited ? 100 : 0,
      }).eq('id', order.id).neq('status', 'cancelled')
      if (error) throw error
      toast.success('Order cancelled.')
      refetch()
    } catch (err: any) {
      console.error('Cancel order failed:', err)
      toast.error(err?.message || 'Failed to cancel order, please try again')
    }
    setSaving(false)
  }

  async function submitRating(val: number) {
    if (!order) return
    setRating(val)
    const { error } = await supabase.from('orders').update({ rating: val }).eq('id', order.id)
    if (error) { console.error('Rating submit failed:', error); return }
    if (order.worker_id) {
      const { data: w } = await supabase
        .from('workers')
        .select('avg_rating, total_ratings, consecutive_bad_ratings, resume_stars')
        .eq('id', order.worker_id)
        .single()
      if (w) {
        const newTotal = (w.total_ratings || 0) + 1
        const newAvg = ((w.avg_rating || 0) * (w.total_ratings || 0) + val) / newTotal
        const prevBad = w.consecutive_bad_ratings ?? 0
        const prevResume = w.resume_stars ?? 0

        const workerUpdate: Record<string, unknown> = {
          avg_rating: Math.round(newAvg * 100) / 100,
          total_ratings: newTotal,
        }

        if (val >= 4) {
          // Good rating — reset bad streak
          workerUpdate.consecutive_bad_ratings = 0
          // If paused (3+ bad), count 5-star jobs toward resume
          if (prevBad >= 3 && val === 5) {
            workerUpdate.resume_stars = prevResume + 1
            // If they hit 2 resume stars, fully reset
            if (prevResume + 1 >= 2) {
              workerUpdate.consecutive_bad_ratings = 0
              workerUpdate.resume_stars = 0
            }
          } else {
            workerUpdate.resume_stars = 0
          }
        } else {
          // Bad rating (< 4)
          workerUpdate.consecutive_bad_ratings = prevBad + 1
          workerUpdate.resume_stars = 0
        }

        await supabase.from('workers').update(workerUpdate).eq('id', order.worker_id)
      }
    }
    toast.success('Thank you for your rating!')
    setShowRatingPopup(false)
    navigate('/customer')
  }

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>
  if (!order) return <div className="p-6 text-slate-400">Order not found</div>

  const summaryKey = getSummaryKey(order.status, order.worker_id, order.mat_cost_admin)
  const summary = STEP_SUMMARY[summaryKey] ?? STEP_SUMMARY['booked_searching']

  // Show live tracking for all active statuses where worker is on the job
  const showLiveTracking = !!order.worker_id &&
    ['booked', 'worker_visiting', 'inspecting', 'quote_sent', 'in_progress', 'material_collected', 'done_uploaded'].includes(order.status)

  return (
    <div className="page-content px-5 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/customer/orders')} className="text-slate-400">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-black font-heading text-slate-50 text-xl">{order.service}</h1>
          <p className="text-slate-500 text-xs">{order.id} · {formatDate(order.created_at)}</p>
        </div>
        <div className="ml-auto"><StatusBadge status={order.status} /></div>
      </div>

      {/* ── 1. Status Summary Card (animated) ─────────────────────── */}
      <Card
        className="mb-4 overflow-hidden"
        style={{ borderColor: summary.color + '40', background: summary.bg }}
      >
        <div className="flex items-center gap-4">
          <div
            className="text-4xl shrink-0 select-none"
            style={{ animation: 'summaryPulse 2.4s ease-in-out infinite' }}
          >
            {summary.icon}
          </div>
          <div>
            <p className="font-black text-slate-50 text-lg leading-tight">{summary.title}</p>
            <p className="text-slate-400 text-sm mt-0.5 leading-snug">{summary.desc}</p>
          </div>
        </div>
        <style>{`
          @keyframes summaryPulse {
            0%, 100% { transform: scale(1) rotate(0deg); }
            40%       { transform: scale(1.18) rotate(-4deg); }
            60%       { transform: scale(1.18) rotate(4deg); }
          }
        `}</style>
      </Card>

      {/* ── Preferred worker unavailable notice ─────────────────────── */}
      {order.preferred_worker_code && !order.preferred_worker_id && !order.worker_id && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4 flex items-start gap-3">
          <span className="text-xl shrink-0">⚠️</span>
          <div>
            <p className="text-amber-400 font-bold text-sm">Your requested Pro is currently not available</p>
            <p className="text-slate-400 text-xs mt-0.5">We will assign the next available Pro for you now</p>
          </div>
        </div>
      )}

      {/* ── 2. Order Journey ───────────────────────────────────────── */}
      <Card className="mb-4">
        <p className="font-bold text-slate-50 mb-4">Order Journey</p>
        <JourneyTracker status={order.status} workerId={order.worker_id} />
      </Card>

      {/* ── 3. Completion Photo + Rating badge (completed) ─────────── */}
      {order.status === 'completed' && (
        <>
          {order.job_photo_url && (
            <Card className="mb-4">
              <p className="font-bold text-slate-50 mb-2">Completion Photo</p>
              <img src={order.job_photo_url} alt="Job done" className="rounded-xl w-full object-cover" />
            </Card>
          )}
          {order.rating && (
            <Card className="mb-4">
              <div className="flex items-center gap-2">
                <span className="text-amber-400">{'★'.repeat(order.rating)}</span>
                <span className="text-slate-400 text-sm">You rated this job</span>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── 4. Live Tracking (worker in field) ─────────────────────── */}
      {showLiveTracking && (
        <Card className="mb-4">
          <p className="font-bold text-slate-50 mb-3">🚗 Live Tracking</p>
          <MapErrorBoundary>
            <Suspense fallback={<div className="bg-slate-800 rounded-xl p-4 text-center"><p className="text-slate-400 text-sm animate-pulse">Loading live tracking…</p></div>}>
              <LiveTrackingMap
                workerId={order.worker_id!}
                workerName={order.worker_name || 'Pro'}
                customerLat={order.customer_lat}
                customerLng={order.customer_lng}
              />
            </Suspense>
          </MapErrorBoundary>
        </Card>
      )}

      {/* ── 4. Arrival OTP (worker assigned, not yet inspecting) ───── */}
      {order.worker_id && order.status === 'booked' && (
        <Card className="mb-4 border-amber-500/30 bg-amber-500/10">
          <p className="text-amber-400 font-bold mb-1">🔑 Arrival OTP</p>
          <p className="text-slate-400 text-sm mb-2">Share this code with the worker when they arrive:</p>
          <div className="text-4xl font-black text-white tracking-widest text-center py-2">
            {order.arrival_otp}
          </div>
        </Card>
      )}

      {/* ── 5. Completion OTP ──────────────────────────────────────── */}
      {order.status === 'done_uploaded' && (
        <Card className="mb-4 border-green-500/30 bg-green-500/10">
          <p className="text-green-400 font-bold mb-1">✅ Completion OTP</p>
          <p className="text-slate-400 text-sm mb-2">Share this code with the worker to confirm job is done:</p>
          <div className="text-5xl font-black text-white tracking-widest text-center py-3">
            {order.comp_otp}
          </div>
        </Card>
      )}

      {/* ── AC Service: Package info card ──────────────────────────── */}
      {PACKAGE_SERVICES.includes(order.service) && order.ac_package_name && (
        <Card className="mb-4 border-blue-500/20 bg-blue-500/5">
          <p className="font-bold text-slate-50 mb-3">❄️ Service Package</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-200 font-semibold text-sm">{order.ac_package_name}</p>
              <p className="text-slate-500 text-xs mt-0.5">Fixed price service</p>
            </div>
            <p className="text-orange-400 font-black text-xl">{formatCurrency(order.ac_package_price || 0)}</p>
          </div>
          <div className="border-t border-slate-700 mt-3 pt-3 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Paid at booking</span>
              <span className="text-green-400 font-semibold">{formatCurrency(order.booking_amt)} ✓</span>
            </div>
            <div className="flex justify-between text-slate-500 text-xs">
              <span className="text-slate-600">  ↳ platform fee + ₹{AC_ADVANCE} advance + processing</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-slate-500">Remaining balance</span>
              <span className={`font-semibold ${order.ac_remaining_paid ? 'text-green-400' : 'text-slate-200'}`}>
                {formatCurrency(Math.max(0, (order.ac_package_price || 0) - AC_ADVANCE))}
                {order.ac_remaining_paid ? ' ✓' : ''}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* ── AC Service: Remaining payment after job done ────────────── */}
      {PACKAGE_SERVICES.includes(order.service) && order.status === 'done_uploaded' && !order.ac_remaining_paid && (
        <Card className="mb-4 border-orange-500/30 bg-orange-500/5">
          <p className="font-bold text-slate-50 mb-2">💳 Complete Your Payment</p>
          <p className="text-slate-400 text-sm mb-4">
            The service is done! Pay the remaining balance to confirm completion.
          </p>
          <div className="flex justify-between items-center mb-4">
            <span className="text-slate-400 text-sm">Remaining balance</span>
            <span className="text-orange-400 font-black text-xl">
              {formatCurrency(Math.max(0, (order.ac_package_price || 0) - AC_ADVANCE))}
            </span>
          </div>
          <Button size="lg" variant="accent" loading={saving} onClick={handleRemainingPay}>
            Pay Remaining →
          </Button>
        </Card>
      )}

      {/* ── 6. Quote + Payment ─────────────────────────────────────── */}
      {order.status === 'quote_sent' && order.mat_cost_admin != null && (
        <Card className="mb-4">
          <p className="font-bold text-slate-50 mb-3">📋 Your Quote</p>
          <div className="flex flex-col gap-2 text-sm">
            <Row label="Labour charges" value={formatCurrency(order.quote_labour || 0)} />
            <Row label="Material cost" value={formatCurrency(order.mat_cost_admin || 0)} />
            <Row
              label="Transaction fee (2.5%)"
              value={formatCurrency(Math.round((order.total_quote || 0) * TRANSACTION_FEE_RATE * 100) / 100)}
            />
          </div>
          <div className="border-t border-slate-700 mt-3 pt-3 flex justify-between items-center">
            <span className="font-bold text-slate-50">Total to pay</span>
            <span className="font-black text-orange-400 text-xl">
              {formatCurrency(Math.round((order.total_quote || 0) * (1 + TRANSACTION_FEE_RATE) * 100) / 100)}
            </span>
          </div>
          <div className="mt-3">
            <Button size="lg" variant="accent" loading={saving} onClick={handleFinalPay}>
              Pay Now →
            </Button>
            <button
              onClick={cancelOrder}
              disabled={saving}
              className="w-full mt-2 py-2.5 text-sm font-semibold text-red-400 border border-red-500/30 rounded-xl bg-red-500/10 disabled:opacity-50"
            >
              Cancel Order
            </button>
            <p className="text-slate-600 text-xs text-center mt-1.5">
              Note: ₹100 of your booking fee will be paid to the Pro for their visit.
            </p>
          </div>
        </Card>
      )}

      {/* ── 6. Details ─────────────────────────────────────────────── */}
      <Card className="mb-4">
        <p className="font-bold text-slate-50 mb-3">Details</p>
        <div className="flex flex-col gap-2 text-sm">
          <Row label="Address" value={order.address} />
          {order.problem_description && <Row label="Problem" value={order.problem_description} />}
          {order.worker_name && (
            <div className="flex items-center gap-3 py-1">
              <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center text-sm font-bold text-slate-50 shrink-0">
                {workerPhoto
                  ? <img src={workerPhoto} alt={order.worker_name} className="w-full h-full object-cover" />
                  : order.worker_name[0]
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-50 text-sm font-semibold">{order.worker_name}</p>
                {workerBadge ? (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold mt-0.5"
                    style={{ background: workerBadge.color + '20', color: workerBadge.color, border: `1px solid ${workerBadge.color}50` }}
                  >
                    {workerBadge.icon} {workerBadge.badge}
                  </span>
                ) : (
                  <p className="text-slate-500 text-xs">Your assigned Pro</p>
                )}
              </div>
              {order.worker_phone && (
                <a
                  href={`tel:${order.worker_phone}`}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs font-bold rounded-xl shrink-0"
                >
                  <Phone size={13} /> Call
                </a>
              )}
            </div>
          )}
          <Row label="Booking fee" value={formatCurrency(order.booking_amt)} />
          <Row
            label="Payment status"
            value={order.booking_paid ? '✅ Booking paid' : '⏳ Awaiting payment confirmation'}
          />
        </div>
      </Card>

      {/* ── Rating Popup ───────────────────────────────────────────── */}
      {showRatingPopup && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="w-full max-w-md bg-slate-900 rounded-t-3xl px-6 pt-8 pb-12"
            style={{ animation: 'slideUp 350ms cubic-bezier(0.32,0.72,0,1)' }}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mb-8" />

            <div className="text-center mb-6">
              <div className="text-5xl mb-3" style={{ animation: 'summaryPulse 2.4s ease-in-out infinite' }}>🎉</div>
              <h2 className="font-black text-slate-50 text-2xl">Job Complete!</h2>
              <p className="text-slate-400 text-sm mt-1">How was your experience with {order.worker_name || 'your Pro'}?</p>
            </div>

            <div className="flex gap-3 justify-center mb-8">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => submitRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                  style={{ transition: 'transform 150ms', transform: n <= (hoverRating || rating) ? 'scale(1.2)' : 'scale(1)' }}
                >
                  <Star
                    size={44}
                    className={n <= (hoverRating || rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}
                  />
                </button>
              ))}
            </div>

            <button
              onClick={() => { setShowRatingPopup(false); navigate('/customer') }}
              className="w-full py-3 text-slate-500 text-sm"
            >
              Skip for now
            </button>
          </div>
          <style>{`
            @keyframes slideUp {
              from { transform: translateY(100%); opacity: 0; }
              to   { transform: translateY(0);    opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-300 text-right">{value}</span>
    </div>
  )
}
