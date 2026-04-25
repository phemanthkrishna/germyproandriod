import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { useCity } from '../../context/CityContext'
import { formatCurrency, formatDate } from '../../lib/utils'
import { toast } from 'sonner'
import type { Order, BonusClaim, PayoutLog } from '../../types'
import { BOOKING_FEE, VISITING_CHARGE } from '../../constants'

const PLATFORM_FEE = BOOKING_FEE - VISITING_CHARGE  // ₹25
const WORKER_VISIT = VISITING_CHARGE                 // ₹100

type Tab = 'pending' | 'settled' | 'log' | 'reconcile'

// ── UPI QR Modal ─────────────────────────────────────────────────────────────
interface UpiPayModalProps {
  payeeName: string
  upiId: string
  amount: number
  note: string
  onConfirm: (ref: string) => void
  onClose: () => void
}

function UpiPayModal({ payeeName, upiId, amount, note, onConfirm, onClose }: UpiPayModalProps) {
  const [ref, setRef] = useState('')
  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&tn=${encodeURIComponent(note)}&cu=INR`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-5 flex flex-col items-center gap-4">
        <div className="w-full flex items-center justify-between">
          <p className="text-slate-50 font-bold text-base">Pay via UPI</p>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">×</button>
        </div>

        {/* QR Code */}
        <div className="bg-white p-3 rounded-xl">
          <QRCodeSVG value={upiLink} size={180} />
        </div>

        <div className="w-full text-center">
          <p className="text-slate-50 font-semibold text-sm">{payeeName}</p>
          <p className="text-blue-400 font-mono text-xs mt-0.5">{upiId}</p>
          <p className="text-green-400 font-black text-2xl mt-1">{formatCurrency(amount)}</p>
          <p className="text-slate-500 text-xs mt-0.5">{note}</p>
        </div>

        <button
          onClick={() => navigator.clipboard.writeText(upiLink).then(() => toast.success('UPI link copied'))}
          className="w-full py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold"
        >
          Copy UPI Link
        </button>

        <div className="w-full">
          <p className="text-slate-400 text-xs mb-1">Enter UTR / Transaction Reference after paying</p>
          <input
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-slate-50 text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
            placeholder="e.g. 407812345678"
            value={ref}
            onChange={e => setRef(e.target.value)}
          />
        </div>

        <div className="w-full flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-400 text-sm font-bold">
            Cancel
          </button>
          <button
            onClick={() => { if (ref.trim()) onConfirm(ref.trim()); else toast.error('Enter the transaction reference') }}
            className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold"
          >
            Confirm Paid
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Row helper ────────────────────────────────────────────────────────────────
function Row({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between items-center px-4 py-3 ${bold ? 'font-bold' : ''}`}>
      <span className="text-slate-400 text-sm">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>{value}</span>
    </div>
  )
}

// ── Money flow mini bar chart ─────────────────────────────────────────────────
interface DayFlow { label: string; inAmt: number; outAmt: number }
function FlowChart({ days }: { days: DayFlow[] }) {
  const maxVal = Math.max(...days.flatMap(d => [d.inAmt, d.outAmt]), 1)
  return (
    <div className="flex items-end gap-1 h-20 mt-2">
      {days.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div className="w-full flex gap-0.5 items-end" style={{ height: 64 }}>
            <div
              className="flex-1 bg-green-500/80 rounded-sm"
              style={{ height: `${Math.max(2, Math.round((d.inAmt / maxVal) * 60))}px` }}
              title={`In: ${formatCurrency(d.inAmt)}`}
            />
            <div
              className="flex-1 bg-orange-500/80 rounded-sm"
              style={{ height: `${Math.max(2, Math.round((d.outAmt / maxVal) * 60))}px` }}
              title={`Out: ${formatCurrency(d.outAmt)}`}
            />
          </div>
          <span className="text-[8px] text-slate-600">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminPayments() {
  const { selectedCity } = useCity()
  const [tab, setTab] = useState<Tab>('pending')
  const [orders, setOrders] = useState<Order[]>([])
  const [workerUpi, setWorkerUpi] = useState<Record<string, string>>({})
  const [bonusClaims, setBonusClaims] = useState<BonusClaim[]>([])
  const [payoutLogs, setPayoutLogs] = useState<PayoutLog[]>([])
  const [modal, setModal] = useState<null | {
    payeeName: string; upiId: string; amount: number; note: string
    onConfirm: (ref: string) => void
  }>(null)

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('admin-payments-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_claims' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payout_logs' }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedCity])

  async function fetchAll() {
    await Promise.all([fetchOrders(), fetchBonusClaims(), fetchPayoutLogs()])
  }

  async function fetchOrders() {
    let query = supabase.from('orders').select('*')
      .not('status', 'eq', 'booked')
      .order('created_at', { ascending: false })
    if (selectedCity) query = query.eq('customer_city', selectedCity)
    const { data } = await query
    const rows = (data as Order[]) || []
    setOrders(rows)
    // fetch UPI IDs
    const ids = [...new Set(rows.map(o => o.worker_id).filter(Boolean))] as string[]
    if (!ids.length) return
    const { data: workers } = await supabase.from('workers').select('id,upi_id').in('id', ids)
    const map: Record<string, string> = {}
    ;(workers || []).forEach((w: { id: string; upi_id: string | null }) => { if (w.upi_id) map[w.id] = w.upi_id })
    setWorkerUpi(map)
  }

  async function fetchBonusClaims() {
    const { data } = await supabase.from('bonus_claims').select('*').order('created_at', { ascending: false })
    const claims = (data as BonusClaim[]) || []
    setBonusClaims(claims)
    const ids = [...new Set(claims.map(c => c.worker_id))]
    if (!ids.length) return
    const { data: workers } = await supabase.from('workers').select('id,upi_id').in('id', ids)
    setWorkerUpi(prev => {
      const next = { ...prev }
      ;(workers || []).forEach((w: { id: string; upi_id: string | null }) => { if (w.upi_id) next[w.id] = w.upi_id })
      return next
    })
  }

  async function fetchPayoutLogs() {
    const { data } = await supabase.from('payout_logs').select('*').order('paid_at', { ascending: false })
    setPayoutLogs((data as PayoutLog[]) || [])
  }

  // ── Log payout to DB ──────────────────────────────────────────────────────
  async function logPayout(entry: Omit<PayoutLog, 'id' | 'created_at'>) {
    await supabase.from('payout_logs').insert([entry])
  }

  // ── Mark Labour Paid (with QR) ─────────────────────────────────────────────
  function openLabourPayModal(o: Order) {
    const upiId = o.worker_id ? workerUpi[o.worker_id] : undefined
    const amount = (o.quote_labour || 0) + WORKER_VISIT
    const note = `GetMyPro Labour - ${o.service} #${o.id.slice(-6).toUpperCase()}`
    if (!upiId) {
      // no UPI — just mark directly with ref input
      const ref = window.prompt(`No UPI on file. Enter payment reference for ${o.worker_name} (${formatCurrency(amount)}):`)
      if (ref !== null) confirmLabourPaid(o, ref.trim())
      return
    }
    setModal({
      payeeName: o.worker_name || 'Worker',
      upiId,
      amount,
      note,
      onConfirm: (ref) => confirmLabourPaid(o, ref),
    })
  }

  async function confirmLabourPaid(o: Order, ref: string) {
    setModal(null)
    const { error } = await supabase.from('orders').update({ labour_pay_settled: true }).eq('id', o.id)
    if (error) { toast.error('Failed to mark payment'); return }
    await logPayout({
      order_id: o.id,
      payee_type: 'worker',
      payee_id: o.worker_id,
      payee_name: o.worker_name || 'Worker',
      payee_upi: o.worker_id ? workerUpi[o.worker_id] : undefined,
      amount: (o.quote_labour || 0) + WORKER_VISIT,
      payment_ref: ref,
      note: `Labour + Visit — ${o.service}`,
      paid_at: new Date().toISOString(),
    })
    toast.success(`Paid — ${o.worker_name} ${formatCurrency((o.quote_labour || 0) + WORKER_VISIT)}`)
    fetchAll()
  }

  // ── Mark Cancellation Paid ─────────────────────────────────────────────────
  function openCancelPayModal(o: Order) {
    const upiId = o.worker_id ? workerUpi[o.worker_id] : undefined
    const amount = o.worker_cancellation_pay || 0
    const note = `GetMyPro Visit Fee - Cancelled #${o.id.slice(-6).toUpperCase()}`
    if (!upiId) {
      const ref = window.prompt(`No UPI on file. Enter payment reference for ${o.worker_name} (${formatCurrency(amount)}):`)
      if (ref !== null) confirmCancelPaid(o, ref.trim())
      return
    }
    setModal({
      payeeName: o.worker_name || 'Worker',
      upiId,
      amount,
      note,
      onConfirm: (ref) => confirmCancelPaid(o, ref),
    })
  }

  async function confirmCancelPaid(o: Order, ref: string) {
    setModal(null)
    const amount = o.worker_cancellation_pay || 0
    const { error } = await supabase.from('orders').update({ cancellation_pay_settled: true }).eq('id', o.id)
    if (error) { toast.error('Failed to mark payment'); return }
    await logPayout({
      order_id: o.id,
      payee_type: 'worker',
      payee_id: o.worker_id,
      payee_name: o.worker_name || 'Worker',
      payee_upi: o.worker_id ? workerUpi[o.worker_id] : undefined,
      amount,
      payment_ref: ref,
      note: 'Cancellation Visit Fee',
      paid_at: new Date().toISOString(),
    })
    toast.success(`Paid — ${o.worker_name} ${formatCurrency(amount)}`)
    fetchAll()
  }

  // ── Mark Bonus Paid ────────────────────────────────────────────────────────
  function openBonusPayModal(c: BonusClaim) {
    const upiId = workerUpi[c.worker_id]
    const note = `GetMyPro ${c.milestone_badge} Bonus - ${c.worker_name}`
    if (!upiId) {
      const ref = window.prompt(`No UPI on file. Enter reference for ${c.worker_name} (${formatCurrency(c.amount)}):`)
      if (ref !== null) confirmBonusPaid(c, ref.trim())
      return
    }
    setModal({
      payeeName: c.worker_name,
      upiId,
      amount: c.amount,
      note,
      onConfirm: (ref) => confirmBonusPaid(c, ref),
    })
  }

  async function confirmBonusPaid(c: BonusClaim, ref: string) {
    setModal(null)
    const { error } = await supabase
      .from('bonus_claims').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', c.id)
    if (error) { toast.error('Failed to mark bonus paid'); return }
    await logPayout({
      payee_type: 'bonus',
      payee_id: c.worker_id,
      payee_name: c.worker_name,
      payee_upi: workerUpi[c.worker_id],
      amount: c.amount,
      payment_ref: ref,
      note: `${c.milestone_badge} Milestone Bonus (${c.milestone_job} jobs)`,
      paid_at: new Date().toISOString(),
    })
    toast.success(`Bonus paid — ${c.worker_name} ${formatCurrency(c.amount)}`)
    fetchAll()
  }

  // ── Derived Data ──────────────────────────────────────────────────────────
  const bookingPaid  = orders.filter(o => o.booking_paid)
  const finalPaid    = orders.filter(o => o.final_paid)
  const completed    = orders.filter(o => o.status === 'completed')
  const cancelled    = orders.filter(o => o.status === 'cancelled' && (o.worker_cancellation_pay || 0) > 0)
  const pendingLabour = completed.filter(o => !o.labour_pay_settled)
  const pendingCancel = cancelled.filter(o => !o.cancellation_pay_settled)
  const pendingBonus  = bonusClaims.filter(c => c.status === 'pending')
  const pendingStore  = orders.filter(o => o.mat_cost_admin && o.mat_cost_admin > 0 && !o.mat_payment_done && o.mat_store_id)
  // Note: store payouts are settled in Materials page; shown here as a count/link only

  const totalIn       = bookingPaid.length * BOOKING_FEE + finalPaid.reduce((s, o) => s + (o.total_quote || 0), 0)
  const platformRev   = bookingPaid.length * PLATFORM_FEE + orders.reduce((s, o) => s + (o.mat_commission || 0), 0)
  const totalOut      = payoutLogs.reduce((s, l) => s + l.amount, 0)
  const netProfit     = platformRev

  const pendingOutAmt =
    pendingLabour.reduce((s, o) => s + (o.quote_labour || 0) + WORKER_VISIT, 0) +
    pendingCancel.reduce((s, o) => s + (o.worker_cancellation_pay || 0), 0) +
    pendingBonus.reduce((s, c) => s + c.amount, 0) +
    pendingStore.reduce((s, o) => s + (o.mat_cost_store || (o.mat_cost_admin || 0) - (o.mat_commission || 0)), 0)

  const totalPendingCount = pendingLabour.length + pendingCancel.length + pendingBonus.length + pendingStore.length

  // ── 14-day money flow chart data ───────────────────────────────────────────
  const flowDays: DayFlow[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400_000)
    const key = d.toISOString().slice(0, 10)
    const inAmt = orders
      .filter(o => o.created_at.slice(0, 10) === key && (o.booking_paid || o.final_paid))
      .reduce((s, o) => s + (o.booking_paid ? BOOKING_FEE : 0) + (o.final_paid ? (o.total_quote || 0) : 0), 0)
    const outAmt = payoutLogs
      .filter(l => l.paid_at.slice(0, 10) === key)
      .reduce((s, l) => s + l.amount, 0)
    return { label: key.slice(5), inAmt, outAmt }
  })

  // ── TABS ─────────────────────────────────────────────────────────────────
  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: 'pending', label: 'Pending', badge: totalPendingCount },
    { id: 'settled', label: 'Settled' },
    { id: 'log', label: 'Payout Log' },
    { id: 'reconcile', label: 'Reconcile' },
  ]

  return (
    <div className="p-6">
      {modal && modal.upiId && (
        <UpiPayModal
          payeeName={modal.payeeName}
          upiId={modal.upiId}
          amount={modal.amount}
          note={modal.note}
          onConfirm={modal.onConfirm}
          onClose={() => setModal(null)}
        />
      )}

      <h1 className="text-2xl font-black font-heading text-slate-50 mb-5">
        {selectedCity ? `${selectedCity} — Payments` : 'Payments & Finance'}
      </h1>

      {/* ── Financial Summary Cards ── */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <SummaryCard label="Total Collected" value={formatCurrency(totalIn)} color="text-green-400" sub="bookings + finals" />
        <SummaryCard label="Platform Revenue" value={formatCurrency(netProfit)} color="text-blue-400" sub="fees + commissions" />
        <SummaryCard label="Pending Payouts" value={formatCurrency(pendingOutAmt)} color="text-amber-400" sub={`${totalPendingCount} items`} />
        <SummaryCard label="Total Paid Out" value={formatCurrency(totalOut)} color="text-orange-400" sub={`${payoutLogs.length} transactions`} />
      </div>

      {/* ── Money Flow Chart ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-slate-50 font-bold text-sm">Money Flow — Last 14 Days</p>
          <div className="flex gap-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500/80 inline-block" /> In</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500/80 inline-block" /> Out</span>
          </div>
        </div>
        <FlowChart days={flowDays} />
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              tab === t.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {t.label}
            {t.badge ? (
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-white/20' : 'bg-amber-500 text-white'}`}>
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ══ TAB: PENDING ══════════════════════════════════════════════════════ */}
      {tab === 'pending' && (
        <div className="flex flex-col gap-6">
          {/* Worker Labour */}
          {pendingLabour.length > 0 && (
            <Section title="Worker Labour Payouts" color="text-amber-400">
              {pendingLabour.map(o => (
                <PayoutCard
                  key={o.id}
                  name={o.worker_name || '—'}
                  sub={`${o.service} · ${o.id.slice(-8).toUpperCase()}`}
                  date={formatDate(o.created_at)}
                  upi={o.worker_id ? workerUpi[o.worker_id] : undefined}
                  amount={(o.quote_labour || 0) + WORKER_VISIT}
                  detail={`Labour ${formatCurrency(o.quote_labour || 0)} + Visit ${formatCurrency(WORKER_VISIT)}`}
                  borderColor="border-amber-500/20"
                  onPay={() => openLabourPayModal(o)}
                />
              ))}
            </Section>
          )}

          {/* Cancellation Payouts */}
          {pendingCancel.length > 0 && (
            <Section title="Cancellation Visit Charges" color="text-red-400">
              {pendingCancel.map(o => (
                <PayoutCard
                  key={o.id}
                  name={o.worker_name || '—'}
                  sub={`${o.service} · Customer cancelled after quote`}
                  date={formatDate(o.created_at)}
                  upi={o.worker_id ? workerUpi[o.worker_id] : undefined}
                  amount={o.worker_cancellation_pay || 0}
                  borderColor="border-red-500/20"
                  onPay={() => openCancelPayModal(o)}
                />
              ))}
            </Section>
          )}

          {/* Store Material Payouts — handled in Materials page */}
          {pendingStore.length > 0 && (
            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-cyan-400 font-semibold text-sm">{pendingStore.length} store payout{pendingStore.length > 1 ? 's' : ''} pending</p>
                <p className="text-slate-500 text-xs mt-0.5">Set commission % and settle in the Materials page</p>
              </div>
              <a href="/admin/materials" className="text-xs px-3 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 font-bold whitespace-nowrap">
                Go to Materials →
              </a>
            </div>
          )}

          {/* Milestone Bonuses */}
          {pendingBonus.length > 0 && (
            <Section title="Milestone Bonus Claims" color="text-purple-400">
              {pendingBonus.map(c => (
                <PayoutCard
                  key={c.id}
                  name={c.worker_name}
                  sub={`${c.milestone_icon} ${c.milestone_badge} · ${c.milestone_job} jobs milestone`}
                  date={formatDate(c.created_at)}
                  upi={workerUpi[c.worker_id]}
                  amount={c.amount}
                  borderColor="border-purple-500/20"
                  onPay={() => openBonusPayModal(c)}
                />
              ))}
            </Section>
          )}

          {totalPendingCount === 0 && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center">
              <p className="text-green-400 font-semibold">All payouts settled ✓</p>
              <p className="text-green-500/60 text-xs mt-1">No pending payments at this time</p>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: SETTLED ══════════════════════════════════════════════════════ */}
      {tab === 'settled' && (
        <div className="flex flex-col gap-2">
          {/* Revenue summary */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl divide-y divide-slate-700 mb-4">
            <Row label={`Booking fees (${bookingPaid.length} × ${formatCurrency(BOOKING_FEE)})`} value={formatCurrency(bookingPaid.length * BOOKING_FEE)} color="text-slate-50" />
            <Row label="Final job payments" value={formatCurrency(finalPaid.reduce((s, o) => s + (o.total_quote || 0), 0))} color="text-slate-50" />
            <Row label="Platform fee cut" value={formatCurrency(bookingPaid.length * PLATFORM_FEE)} color="text-blue-400" />
            <Row label="Material commissions" value={formatCurrency(orders.reduce((s, o) => s + (o.mat_commission || 0), 0))} color="text-blue-400" />
            <Row label="Net Platform Revenue" value={formatCurrency(netProfit)} color="text-green-400" bold />
          </div>

          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Settled Worker Payouts</p>
          {completed.filter(o => o.labour_pay_settled).length === 0 && (
            <p className="text-slate-600 text-sm text-center py-4">No settled payouts yet</p>
          )}
          {completed.filter(o => o.labour_pay_settled).map(o => (
            <div key={o.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm font-semibold">{o.worker_name}</p>
                <p className="text-slate-500 text-xs">{o.service} · {formatDate(o.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-sm font-bold">{formatCurrency((o.quote_labour || 0) + WORKER_VISIT)}</p>
                <p className="text-green-400 text-xs">✓ Paid</p>
              </div>
            </div>
          ))}

          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-4">Settled Bonus Claims</p>
          {bonusClaims.filter(c => c.status === 'paid').length === 0 && (
            <p className="text-slate-600 text-sm text-center py-4">No paid bonuses yet</p>
          )}
          {bonusClaims.filter(c => c.status === 'paid').map(c => (
            <div key={c.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-slate-300 text-sm font-semibold">{c.worker_name}</p>
                <p className="text-slate-500 text-xs">{c.milestone_icon} {c.milestone_badge} · {formatDate(c.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-sm font-bold">{formatCurrency(c.amount)}</p>
                <p className="text-green-400 text-xs">✓ Paid</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ TAB: PAYOUT LOG ═══════════════════════════════════════════════════ */}
      {tab === 'log' && (
        <div className="flex flex-col gap-2">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 mb-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-slate-50 font-black text-lg">{payoutLogs.length}</p>
                <p className="text-slate-500 text-xs">Transactions</p>
              </div>
              <div>
                <p className="text-orange-400 font-black text-lg">{formatCurrency(totalOut)}</p>
                <p className="text-slate-500 text-xs">Total Paid Out</p>
              </div>
              <div>
                <p className="text-blue-400 font-black text-lg">
                  {payoutLogs.filter(l => l.payment_ref).length}
                </p>
                <p className="text-slate-500 text-xs">With Reference</p>
              </div>
            </div>
          </div>

          {payoutLogs.length === 0 && (
            <p className="text-slate-600 text-sm text-center py-8">No payout transactions logged yet.<br />Payouts made from the Pending tab will appear here.</p>
          )}

          {payoutLogs.map(l => (
            <div key={l.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      l.payee_type === 'worker' ? 'bg-amber-500/20 text-amber-400'
                        : l.payee_type === 'store' ? 'bg-cyan-500/20 text-cyan-400'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>{l.payee_type}</span>
                    <p className="text-slate-50 text-sm font-semibold truncate">{l.payee_name}</p>
                  </div>
                  {l.note && <p className="text-slate-500 text-xs truncate">{l.note}</p>}
                  {l.payee_upi && <p className="text-blue-400 text-xs font-mono truncate">UPI: {l.payee_upi}</p>}
                  {l.payment_ref && <p className="text-slate-400 text-xs font-mono">Ref: {l.payment_ref}</p>}
                  <p className="text-slate-600 text-xs mt-0.5">{formatDate(l.paid_at)}</p>
                </div>
                <p className="text-orange-400 font-black text-base shrink-0">{formatCurrency(l.amount)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ TAB: RECONCILIATION ═══════════════════════════════════════════════ */}
      {tab === 'reconcile' && (
        <div className="flex flex-col gap-2">
          <p className="text-slate-400 text-xs mb-2">Per-order breakdown — money in vs money out</p>
          {orders.filter(o => o.booking_paid || o.final_paid).map(o => {
            const moneyIn = (o.booking_paid ? BOOKING_FEE : 0) + (o.final_paid ? (o.total_quote || 0) : 0)
            const moneyOut = (o.labour_pay_settled ? (o.quote_labour || 0) + WORKER_VISIT : 0)
              + (o.cancellation_pay_settled ? (o.worker_cancellation_pay || 0) : 0)
            const platformCut = (o.booking_paid ? PLATFORM_FEE : 0) + (o.mat_commission || 0)
            return (
              <div key={o.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-slate-50 text-xs font-semibold">{o.service} · {o.worker_name || 'Unassigned'}</p>
                    <p className="text-slate-600 text-[10px]">{o.id.slice(-12).toUpperCase()} · {formatDate(o.created_at)}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    o.status === 'completed' ? 'bg-green-500/20 text-green-400'
                      : o.status === 'cancelled' ? 'bg-red-500/20 text-red-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}>{o.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                  <div>
                    <p className="text-green-400 font-bold text-sm">{formatCurrency(moneyIn)}</p>
                    <p className="text-slate-600 text-[10px]">Collected</p>
                  </div>
                  <div>
                    <p className="text-orange-400 font-bold text-sm">{formatCurrency(moneyOut)}</p>
                    <p className="text-slate-600 text-[10px]">Paid Out</p>
                  </div>
                  <div>
                    <p className="text-blue-400 font-bold text-sm">{formatCurrency(platformCut)}</p>
                    <p className="text-slate-600 text-[10px]">Platform</p>
                  </div>
                </div>
              </div>
            )
          })}
          {orders.filter(o => o.booking_paid || o.final_paid).length === 0 && (
            <p className="text-slate-600 text-sm text-center py-8">No paid orders yet</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SummaryCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-3.5">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className={`font-black text-xl ${color}`}>{value}</p>
      {sub && <p className="text-slate-600 text-[10px] mt-0.5">{sub}</p>}
    </div>
  )
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${color}`}>{title}</p>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

function PayoutCard({
  name, sub, date, upi, amount, detail, borderColor, onPay,
}: {
  name: string; sub: string; date: string; upi?: string; amount: number
  detail?: string; borderColor: string; onPay: () => void
}) {
  return (
    <div className={`bg-slate-800 border ${borderColor} rounded-xl p-3 flex items-center justify-between gap-3`}>
      <div className="flex-1 min-w-0">
        <p className="text-slate-50 text-sm font-semibold truncate">{name}</p>
        <p className="text-slate-500 text-xs truncate">{sub}</p>
        <p className="text-slate-600 text-xs">{date}</p>
        {detail && <p className="text-slate-400 text-xs mt-0.5">{detail}</p>}
        {upi
          ? <p className="text-blue-400 text-xs font-mono mt-1 truncate">UPI: {upi}</p>
          : <p className="text-slate-600 text-xs mt-1">No UPI on file</p>
        }
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className="text-orange-400 font-black text-base">{formatCurrency(amount)}</span>
        <button
          onClick={onPay}
          className="text-xs px-3 py-1.5 rounded-lg bg-green-500 text-white font-bold"
        >
          {upi ? 'Pay QR' : 'Mark Paid'}
        </button>
      </div>
    </div>
  )
}
