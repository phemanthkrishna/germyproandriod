import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { formatCurrency, formatDate } from '../../lib/utils'
import { TrendingUp, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import type { Order } from '../../types'

const DISCOUNT_OPTIONS = [15, 17, 18, 20]

export default function AdminMaterials() {
  const [orders, setOrders] = useState<Order[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [discounts, setDiscounts] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchOrders()
    const channel = supabase
      .channel('admin-materials-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => fetchOrders())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .not('quote_materials', 'eq', '[]')
      .order('created_at', { ascending: false })
    if (error) console.error('Failed to load material orders:', error.message)
    const rows = (data as Order[]) || []
    setOrders(rows)
    // Default discount for unpaid orders
    const defaults: Record<string, number> = {}
    rows.filter(o => !o.mat_payment_done).forEach(o => { defaults[o.id] = 15 })
    setDiscounts(prev => ({ ...defaults, ...prev }))
  }

  async function markPaid(order: Order) {
    const pct = discounts[order.id] ?? 15
    const cost = order.mat_cost_admin || 0
    const commission = Math.round(cost * pct / 100)
    const payToStore = cost - commission

    setSaving(order.id)
    const { error } = await supabase.from('orders').update({
      mat_payment_done: true,
      mat_discount_pct: pct,
      mat_commission: commission,
    }).eq('id', order.id)
    if (error) toast.error(error.message)
    else toast.success(`Settled! Commission earned: ${formatCurrency(commission)} (${pct}%) · Pay store: ${formatCurrency(payToStore)}`)
    fetchOrders()
    setSaving(null)
  }

  const unpaid = orders.filter(o => !o.mat_payment_done)
  const paid = orders.filter(o => o.mat_payment_done)

  const totalDue = unpaid.reduce((s, o) => s + (o.mat_cost_admin || 0), 0)
  const totalCommissionPending = unpaid.reduce((s, o) => {
    const pct = discounts[o.id] ?? 15
    return s + Math.round((o.mat_cost_admin || 0) * pct / 100)
  }, 0)
  const totalPayToStore = totalDue - totalCommissionPending
  const totalCommissionEarned = paid.reduce((s, o) => s + (o.mat_commission || 0), 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-black font-heading text-slate-50">Materials</h1>
        <Link to="/admin/stores" className="flex items-center gap-1 text-xs text-blue-400 border border-blue-500/30 rounded-lg px-3 py-1.5">
          <Store size={12} /> Stores
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
          <p className="text-slate-400 text-xs mb-1">Billed to Customers</p>
          <p className="text-xl font-black text-red-400">{formatCurrency(totalDue)}</p>
          <p className="text-slate-600 text-xs mt-1">{unpaid.length} pending</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
          <p className="text-slate-400 text-xs mb-1">Commission Earned</p>
          <p className="text-xl font-black text-green-400">{formatCurrency(totalCommissionEarned)}</p>
          <p className="text-slate-600 text-xs mt-1">{paid.length} settled</p>
        </div>
      </div>

      {/* Pending breakdown */}
      {unpaid.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-5 flex justify-between items-center">
          <div>
            <p className="text-blue-300 text-xs font-semibold">Estimated commission this week</p>
            <p className="text-blue-200 text-xs mt-0.5">After discount, pay stores: {formatCurrency(totalPayToStore)}</p>
          </div>
          <div className="flex items-center gap-1 text-green-400">
            <TrendingUp size={14} />
            <span className="font-black text-sm">{formatCurrency(totalCommissionPending)}</span>
          </div>
        </div>
      )}

      {/* Unpaid orders */}
      {unpaid.length > 0 && (
        <>
          <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3">Pending — Settle with partner stores</p>
          <div className="flex flex-col gap-3 mb-6">
            {unpaid.map(o => (
              <MaterialCard
                key={o.id}
                order={o}
                discount={discounts[o.id] ?? 15}
                onDiscountChange={pct => setDiscounts(prev => ({ ...prev, [o.id]: pct }))}
                onPay={() => markPaid(o)}
                saving={saving === o.id}
              />
            ))}
          </div>
        </>
      )}

      {unpaid.length === 0 && (
        <Card className="mb-6 text-center py-6">
          <p className="text-green-400 font-semibold text-sm">All material payments settled ✓</p>
        </Card>
      )}

      {/* Settled history */}
      {paid.length > 0 && (
        <>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Settled History</p>
          <div className="flex flex-col gap-2">
            {paid.map(o => {
              const payToStore = (o.mat_cost_admin || 0) - (o.mat_commission || 0)
              return (
                <div key={o.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-slate-300 text-sm font-semibold">{o.service_emoji} {o.service}</p>
                      <p className="text-slate-500 text-xs">{o.id} · {formatDate(o.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400 text-xs line-through">{formatCurrency(o.mat_cost_admin || 0)}</p>
                      <p className="text-green-400 text-xs font-semibold">+{formatCurrency(o.mat_commission || 0)} commission ({o.mat_discount_pct}%)</p>
                      <p className="text-slate-300 text-xs">Paid store: {formatCurrency(payToStore)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {orders.length === 0 && (
        <div className="text-center py-16 text-slate-500 text-sm">No material orders yet</div>
      )}

    </div>
  )
}

function MaterialCard({
  order, discount, onDiscountChange, onPay, saving,
}: {
  order: Order
  discount: number
  onDiscountChange: (pct: number) => void
  onPay: () => void
  saving: boolean
}) {
  const cost = order.mat_cost_admin || 0
  const commission = Math.round(cost * discount / 100)
  const payToStore = cost - commission

  return (
    <Card>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-3">
          <p className="font-bold text-slate-50 text-sm truncate">{order.service_emoji} {order.service}</p>
          <p className="text-slate-500 text-xs truncate">{order.id} · {order.worker_name || '—'}</p>
          <p className="text-slate-600 text-xs">{formatDate(order.created_at)}</p>
        </div>
        <p className="text-orange-400 font-black text-base shrink-0">{formatCurrency(cost)}</p>
      </div>

      {/* Materials list */}
      {Array.isArray(order.quote_materials) && order.quote_materials.length > 0 && (
        <div className="border-t border-slate-700 pt-2 mb-3">
          <p className="text-slate-500 text-xs mb-1.5">Items</p>
          {order.quote_materials.map((m, i) => (
            <p key={i} className="text-slate-400 text-xs">{m.name} × {m.qty} {m.unit}</p>
          ))}
        </div>
      )}

      {/* Discount selector */}
      <div className="border-t border-slate-700 pt-3 mb-3">
        <p className="text-slate-400 text-xs mb-2">Partner store discount (your commission)</p>
        <div className="flex gap-2 mb-3 items-center">
          {DISCOUNT_OPTIONS.map(pct => (
            <button
              key={pct}
              onClick={() => onDiscountChange(pct)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                discount === pct
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {pct}%
            </button>
          ))}
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              min="1"
              max="100"
              placeholder="Custom"
              className="w-16 bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-slate-50 text-xs outline-none focus:border-green-500 text-center"
              onChange={e => {
                const val = Number(e.target.value)
                if (val >= 1 && val <= 100) onDiscountChange(val)
              }}
            />
            <span className="text-slate-500 text-xs">%</span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="bg-slate-900 rounded-xl p-3 flex flex-col gap-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Billed to customer</span>
            <span className="text-slate-50">{formatCurrency(cost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-green-400">Your commission ({discount}%)</span>
            <span className="text-green-400 font-bold">− {formatCurrency(commission)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-700 pt-1.5 font-bold">
            <span className="text-slate-300">Pay to store</span>
            <span className="text-slate-50">{formatCurrency(payToStore)}</span>
          </div>
        </div>
      </div>

      <button
        onClick={onPay}
        disabled={saving}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded-xl py-2.5 text-sm transition-colors"
      >
        {saving ? 'Saving...' : `Settle — Pay ${formatCurrency(payToStore)} to store ✓`}
      </button>
    </Card>
  )
}
