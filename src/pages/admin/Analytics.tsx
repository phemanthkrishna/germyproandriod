import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { SERVICES, PLATFORM_FEE } from '../../constants'
import { formatCurrency } from '../../lib/utils'
import type { Order } from '../../types'

type Period = '7d' | '30d' | 'all'

interface WorkerStat { worker_id: string; worker_name: string; count: number; avg_rating: number }

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
      <p className="text-slate-400 text-xs font-medium mb-1">{label}</p>
      <p className="text-slate-50 text-2xl font-black">{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
    </div>
  )
}

function Bar({ label, count, max, color = 'bg-blue-500' }: { label: string; count: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-400 text-xs w-28 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-slate-300 text-xs w-8 text-right shrink-0">{count}</span>
    </div>
  )
}

export default function AdminAnalytics() {
  const [period, setPeriod] = useState<Period>('30d')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load(period) }, [period])

  async function load(p: Period) {
    setLoading(true)
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (p !== 'all') {
      const days = p === '7d' ? 7 : 30
      const since = new Date(Date.now() - days * 86400_000).toISOString()
      query = query.gte('created_at', since)
    }
    const { data } = await query
    setOrders((data as Order[]) || [])
    setLoading(false)
  }

  // ── Revenue metrics ──
  const bookingRevenue = orders.filter(o => o.booking_paid).reduce((s, o) => s + (o.booking_amt || 0), 0)
  const finalRevenue   = orders.filter(o => o.final_paid).reduce((s, o) => s + (o.total_quote || 0), 0)
  const platformFees   = orders.filter(o => o.booking_paid).length * PLATFORM_FEE
  const totalRevenue   = bookingRevenue + finalRevenue

  // ── Order counts ──
  const completed  = orders.filter(o => o.status === 'completed').length
  const cancelled  = orders.filter(o => o.status === 'cancelled').length
  const active     = orders.filter(o => !['completed', 'cancelled'].includes(o.status)).length
  const convRate   = (completed + cancelled) > 0
    ? Math.round((completed / (completed + cancelled)) * 100)
    : 0

  // ── Avg rating ──
  const rated   = orders.filter(o => o.rating != null)
  const avgRating = rated.length > 0
    ? (rated.reduce((s, o) => s + (o.rating || 0), 0) / rated.length).toFixed(1)
    : '—'

  // ── Service breakdown ──
  const bySvc: Record<string, number> = {}
  for (const o of orders) bySvc[o.service] = (bySvc[o.service] || 0) + 1
  const svcEntries = Object.entries(bySvc).sort((a, b) => b[1] - a[1])
  const maxSvc = svcEntries[0]?.[1] || 1

  // ── Worker leaderboard ──
  const workerMap: Record<string, WorkerStat> = {}
  for (const o of orders.filter(o => o.status === 'completed' && o.worker_id)) {
    const id = o.worker_id!
    if (!workerMap[id]) workerMap[id] = { worker_id: id, worker_name: o.worker_name || 'Unknown', count: 0, avg_rating: 0 }
    workerMap[id].count++
  }
  // compute avg rating from rated orders
  const ratingAcc: Record<string, number[]> = {}
  for (const o of orders.filter(o => o.rating != null && o.worker_id)) {
    const id = o.worker_id!
    if (!ratingAcc[id]) ratingAcc[id] = []
    ratingAcc[id].push(o.rating!)
  }
  for (const [id, ratings] of Object.entries(ratingAcc)) {
    if (workerMap[id]) workerMap[id].avg_rating = parseFloat((ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1))
  }
  const topWorkers = Object.values(workerMap).sort((a, b) => b.count - a.count).slice(0, 5)
  const maxWorker  = topWorkers[0]?.count || 1

  // ── Daily trend (last N days) ──
  const trendDays = period === '7d' ? 7 : 14
  const dayLabels: string[] = []
  const dayCounts: number[] = []
  for (let i = trendDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000)
    const key = d.toISOString().slice(0, 10)
    dayLabels.push(key.slice(5)) // MM-DD
    dayCounts.push(orders.filter(o => o.created_at.slice(0, 10) === key).length)
  }
  const maxDay = Math.max(...dayCounts, 1)

  const PERIODS: { value: Period; label: string }[] = [
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: 'all', label: 'All time' },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black font-heading text-slate-50">Analytics</h1>
          <p className="text-slate-400 text-sm mt-0.5">{orders.length} orders in period</p>
        </div>
        <div className="flex gap-1.5">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                period === p.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm text-center py-16">Loading...</p>
      ) : (
        <>
          {/* Revenue cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} sub="bookings + final payments" />
            <StatCard label="Platform Fees" value={formatCurrency(platformFees)} sub={`₹${PLATFORM_FEE} × ${orders.filter(o => o.booking_paid).length} bookings`} />
            <StatCard label="Completed Jobs" value={String(completed)} sub={`${convRate}% conversion rate`} />
            <StatCard label="Avg Rating" value={`${avgRating} ★`} sub={`from ${rated.length} ratings`} />
          </div>

          {/* Order status summary */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-5">
            <p className="text-slate-50 font-bold text-sm mb-3">Order Status</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Active', value: active, color: 'text-blue-400' },
                { label: 'Completed', value: completed, color: 'text-green-400' },
                { label: 'Cancelled', value: cancelled, color: 'text-red-400' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-slate-500 text-xs">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Daily trend */}
          {period !== 'all' && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-5">
              <p className="text-slate-50 font-bold text-sm mb-3">Bookings — last {trendDays} days</p>
              <div className="flex items-end gap-1 h-16">
                {dayCounts.map((c, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-blue-500/80 rounded-sm"
                      style={{ height: `${Math.max(4, Math.round((c / maxDay) * 52))}px` }}
                    />
                    <span className="text-[9px] text-slate-600 rotate-45 origin-left">{dayLabels[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Service breakdown */}
          {svcEntries.length > 0 && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-5">
              <p className="text-slate-50 font-bold text-sm mb-3">By Service</p>
              <div className="flex flex-col gap-2.5">
                {svcEntries.map(([svc, count]) => {
                  const s = SERVICES.find(x => x.name === svc)
                  return (
                    <Bar key={svc} label={`${s?.emoji ?? ''} ${svc}`} count={count} max={maxSvc} color="bg-orange-500" />
                  )
                })}
              </div>
            </div>
          )}

          {/* Top workers */}
          {topWorkers.length > 0 && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-5">
              <p className="text-slate-50 font-bold text-sm mb-3">Top Workers</p>
              <div className="flex flex-col gap-2.5">
                {topWorkers.map((w, i) => (
                  <div key={w.worker_id} className="flex items-center gap-3">
                    <span className="text-slate-500 text-xs w-4 text-center shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 text-xs font-semibold truncate">{w.worker_name}</p>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${Math.round((w.count / maxWorker) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-slate-300 text-xs font-bold">{w.count} jobs</p>
                      {w.avg_rating > 0 && <p className="text-yellow-400 text-[10px]">{w.avg_rating} ★</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

    </div>
  )
}
