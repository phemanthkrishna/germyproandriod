import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useCity } from '../../context/CityContext'
import { SERVICES, PLATFORM_FEE } from '../../constants'
import { formatCurrency } from '../../lib/utils'
import type { Order, PayoutLog } from '../../types'
import { BOOKING_FEE, VISITING_CHARGE } from '../../constants'

const WORKER_VISIT = VISITING_CHARGE

type Period = '7d' | '30d' | 'all'
type Section = 'overview' | 'financial' | 'workers' | 'services'

interface WorkerStat { worker_id: string; worker_name: string; count: number; avg_rating: number; earnings: number }

function StatCard({ label, value, sub, color = 'text-slate-50' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
      <p className="text-slate-400 text-xs font-medium mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
    </div>
  )
}

function Bar({ label, count, max, value, color = 'bg-blue-500' }: { label: string; count: number; max: number; value?: string; color?: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-400 text-xs w-28 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-slate-300 text-xs w-16 text-right shrink-0">{value ?? count}</span>
    </div>
  )
}

export default function AdminAnalytics() {
  const { selectedCity } = useCity()
  const [period, setPeriod] = useState<Period>('30d')
  const [section, setSection] = useState<Section>('overview')
  const [orders, setOrders] = useState<Order[]>([])
  const [payoutLogs, setPayoutLogs] = useState<PayoutLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load(period) }, [period, selectedCity])

  async function load(p: Period) {
    setLoading(true)
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (p !== 'all') {
      const since = new Date(Date.now() - (p === '7d' ? 7 : 30) * 86400_000).toISOString()
      query = query.gte('created_at', since)
    }
    if (selectedCity) query = query.eq('customer_city', selectedCity)
    const [{ data: ordersData }, { data: logsData }] = await Promise.all([
      query,
      supabase.from('payout_logs').select('*').order('paid_at', { ascending: false }),
    ])
    setOrders((ordersData as Order[]) || [])
    setPayoutLogs((logsData as PayoutLog[]) || [])
    setLoading(false)
  }

  // ── Revenue metrics ──
  const bookingRevenue  = orders.filter(o => o.booking_paid).reduce((s, o) => s + (o.booking_amt || 0), 0)
  const finalRevenue    = orders.filter(o => o.final_paid).reduce((s, o) => s + (o.total_quote || 0), 0)
  const matCommission   = orders.reduce((s, o) => s + (o.mat_commission || 0), 0)
  const platformFees    = orders.filter(o => o.booking_paid).length * PLATFORM_FEE
  const totalRevenue    = bookingRevenue + finalRevenue
  const netProfit       = platformFees + matCommission

  // ── Payout metrics ──
  const totalPaidOut    = payoutLogs.reduce((s, l) => s + l.amount, 0)
  const workerPayouts   = payoutLogs.filter(l => l.payee_type === 'worker').reduce((s, l) => s + l.amount, 0)
  const storePayouts    = payoutLogs.filter(l => l.payee_type === 'store').reduce((s, l) => s + l.amount, 0)
  const bonusPayouts    = payoutLogs.filter(l => l.payee_type === 'bonus').reduce((s, l) => s + l.amount, 0)

  // ── Order counts ──
  const completed   = orders.filter(o => o.status === 'completed').length
  const cancelled   = orders.filter(o => o.status === 'cancelled').length
  const active      = orders.filter(o => !['completed', 'cancelled'].includes(o.status)).length
  const convRate    = (completed + cancelled) > 0 ? Math.round((completed / (completed + cancelled)) * 100) : 0

  // ── Avg rating ──
  const rated     = orders.filter(o => o.rating != null)
  const avgRating = rated.length > 0
    ? (rated.reduce((s, o) => s + (o.rating || 0), 0) / rated.length).toFixed(1) : '—'

  // ── Service breakdown ──
  const bySvc: Record<string, { count: number; revenue: number }> = {}
  for (const o of orders) {
    if (!bySvc[o.service]) bySvc[o.service] = { count: 0, revenue: 0 }
    bySvc[o.service].count++
    if (o.final_paid) bySvc[o.service].revenue += o.total_quote || 0
  }
  const svcEntries = Object.entries(bySvc).sort((a, b) => b[1].count - a[1].count)
  const maxSvc     = svcEntries[0]?.[1].count || 1

  // ── Worker leaderboard ──
  const workerMap: Record<string, WorkerStat> = {}
  for (const o of orders.filter(o => o.status === 'completed' && o.worker_id)) {
    const id = o.worker_id!
    if (!workerMap[id]) workerMap[id] = { worker_id: id, worker_name: o.worker_name || 'Unknown', count: 0, avg_rating: 0, earnings: 0 }
    workerMap[id].count++
    workerMap[id].earnings += (o.quote_labour || 0) + WORKER_VISIT
  }
  const ratingAcc: Record<string, number[]> = {}
  for (const o of orders.filter(o => o.rating != null && o.worker_id)) {
    const id = o.worker_id!
    if (!ratingAcc[id]) ratingAcc[id] = []
    ratingAcc[id].push(o.rating!)
  }
  for (const [id, ratings] of Object.entries(ratingAcc)) {
    if (workerMap[id]) workerMap[id].avg_rating = parseFloat((ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1))
  }
  const topWorkers  = Object.values(workerMap).sort((a, b) => b.count - a.count).slice(0, 8)
  const maxWorker   = topWorkers[0]?.count || 1
  const maxEarnings = Math.max(...topWorkers.map(w => w.earnings), 1)

  // ── Store material analytics ──
  const storeMap: Record<string, { name: string; count: number; matRevenue: number; commission: number }> = {}
  for (const o of orders.filter(o => o.mat_store_id)) {
    const id = o.mat_store_id!
    if (!storeMap[id]) storeMap[id] = { name: o.mat_store_name || 'Unknown', count: 0, matRevenue: 0, commission: 0 }
    storeMap[id].count++
    storeMap[id].matRevenue += o.mat_cost_admin || 0
    storeMap[id].commission += o.mat_commission || 0
  }
  const storeEntries  = Object.entries(storeMap).sort((a, b) => b[1].matRevenue - a[1].matRevenue)
  const maxStoreMat   = storeEntries[0]?.[1].matRevenue || 1

  // ── Daily trend ──
  const trendDays = period === '7d' ? 7 : 14
  const dayLabels: string[] = []
  const dayCounts: number[] = []
  const dayRevenue: number[] = []
  for (let i = trendDays - 1; i >= 0; i--) {
    const d   = new Date(Date.now() - i * 86400_000)
    const key = d.toISOString().slice(0, 10)
    dayLabels.push(key.slice(5))
    const dayOrders = orders.filter(o => o.created_at.slice(0, 10) === key)
    dayCounts.push(dayOrders.length)
    dayRevenue.push(dayOrders.filter(o => o.booking_paid).length * BOOKING_FEE +
      dayOrders.filter(o => o.final_paid).reduce((s, o) => s + (o.total_quote || 0), 0))
  }
  const maxDay    = Math.max(...dayCounts, 1)
  const maxRevDay = Math.max(...dayRevenue, 1)

  const PERIODS: { value: Period; label: string }[] = [
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: 'all', label: 'All time' },
  ]

  const SECTIONS: { id: Section; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'financial', label: 'Financial' },
    { id: 'workers', label: 'Workers' },
    { id: 'services', label: 'Services' },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black font-heading text-slate-50">Analytics</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {orders.length} orders {selectedCity ? `in ${selectedCity}` : 'across all cities'}
          </p>
        </div>
        <div className="flex gap-1.5">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                period === p.value ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              section === s.id ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm text-center py-16">Loading...</p>
      ) : (
        <>
          {/* ══ OVERVIEW ══════════════════════════════════════════════════════ */}
          {section === 'overview' && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} sub="bookings + final payments" color="text-green-400" />
                <StatCard label="Platform Profit" value={formatCurrency(netProfit)} sub="fees + commissions" color="text-blue-400" />
                <StatCard label="Completed Jobs" value={String(completed)} sub={`${convRate}% conversion`} />
                <StatCard label="Avg Rating" value={`${avgRating} ★`} sub={`from ${rated.length} ratings`} />
              </div>

              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-5">
                <p className="text-slate-50 font-bold text-sm mb-3">Order Status</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: 'Active', value: active, color: 'text-blue-400' },
                    { label: 'Completed', value: completed, color: 'text-green-400' },
                    { label: 'Cancelled', value: cancelled, color: 'text-red-400' },
                  ].map(s => (
                    <div key={s.label}>
                      <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-slate-500 text-xs">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

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
            </>
          )}

          {/* ══ FINANCIAL ══════════════════════════════════════════════════════ */}
          {section === 'financial' && (
            <>
              {/* Revenue breakdown */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <StatCard label="Booking Revenue" value={formatCurrency(bookingRevenue)} sub={`${orders.filter(o => o.booking_paid).length} bookings`} color="text-slate-50" />
                <StatCard label="Final Job Revenue" value={formatCurrency(finalRevenue)} sub={`${orders.filter(o => o.final_paid).length} jobs`} color="text-slate-50" />
                <StatCard label="Platform Fees" value={formatCurrency(platformFees)} sub={`₹${PLATFORM_FEE} × bookings`} color="text-blue-400" />
                <StatCard label="Material Commissions" value={formatCurrency(matCommission)} sub="from store orders" color="text-blue-400" />
              </div>

              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-5">
                <p className="text-slate-50 font-bold text-sm mb-3">Payout Breakdown</p>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Worker Labour + Visit</span>
                    <span className="text-orange-400 font-bold text-sm">{formatCurrency(workerPayouts)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Store Settlements</span>
                    <span className="text-cyan-400 font-bold text-sm">{formatCurrency(storePayouts)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Milestone Bonuses</span>
                    <span className="text-purple-400 font-bold text-sm">{formatCurrency(bonusPayouts)}</span>
                  </div>
                  <div className="h-px bg-slate-700 my-1" />
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 text-sm font-bold">Total Paid Out</span>
                    <span className="text-orange-400 font-black text-base">{formatCurrency(totalPaidOut)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 text-sm font-bold">Net Platform Profit</span>
                    <span className="text-green-400 font-black text-base">{formatCurrency(netProfit)}</span>
                  </div>
                </div>
              </div>

              {/* Daily revenue trend */}
              {period !== 'all' && (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-5">
                  <p className="text-slate-50 font-bold text-sm mb-3">Daily Revenue — last {trendDays} days</p>
                  <div className="flex items-end gap-1 h-16">
                    {dayRevenue.map((rev, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-green-500/80 rounded-sm"
                          style={{ height: `${Math.max(4, Math.round((rev / maxRevDay) * 52))}px` }}
                          title={formatCurrency(rev)}
                        />
                        <span className="text-[9px] text-slate-600 rotate-45 origin-left">{dayLabels[i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Avg order value */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <StatCard
                  label="Avg Order Value"
                  value={orders.filter(o => o.final_paid).length > 0
                    ? formatCurrency(finalRevenue / orders.filter(o => o.final_paid).length)
                    : '—'}
                  sub="final paid orders"
                />
                <StatCard
                  label="Avg Material Bill"
                  value={orders.filter(o => o.mat_cost_admin && o.mat_cost_admin > 0).length > 0
                    ? formatCurrency(
                        orders.reduce((s, o) => s + (o.mat_cost_admin || 0), 0) /
                        orders.filter(o => o.mat_cost_admin && o.mat_cost_admin > 0).length
                      )
                    : '—'}
                  sub="per material order"
                />
              </div>
            </>
          )}

          {/* ══ WORKERS ════════════════════════════════════════════════════════ */}
          {section === 'workers' && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <StatCard label="Active Workers" value={String(Object.keys(workerMap).length)} sub="with completed jobs" />
                <StatCard label="Avg Rating" value={`${avgRating} ★`} sub={`from ${rated.length} ratings`} />
              </div>

              {topWorkers.length > 0 && (
                <>
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-5">
                    <p className="text-slate-50 font-bold text-sm mb-3">Top Workers — Jobs Completed</p>
                    <div className="flex flex-col gap-2.5">
                      {topWorkers.map((w, i) => (
                        <div key={w.worker_id} className="flex items-center gap-3">
                          <span className="text-slate-500 text-xs w-4 text-center shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-200 text-xs font-semibold truncate">{w.worker_name}</p>
                            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mt-1">
                              <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.round((w.count / maxWorker) * 100)}%` }} />
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

                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-5">
                    <p className="text-slate-50 font-bold text-sm mb-3">Top Workers — Earnings</p>
                    <div className="flex flex-col gap-2.5">
                      {[...topWorkers].sort((a, b) => b.earnings - a.earnings).map((w, i) => (
                        <Bar
                          key={w.worker_id}
                          label={`${i + 1}. ${w.worker_name}`}
                          count={w.earnings}
                          max={maxEarnings}
                          value={formatCurrency(w.earnings)}
                          color="bg-amber-500"
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
              {topWorkers.length === 0 && (
                <p className="text-slate-600 text-sm text-center py-8">No completed jobs in this period</p>
              )}
            </>
          )}

          {/* ══ SERVICES ═══════════════════════════════════════════════════════ */}
          {section === 'services' && (
            <>
              {svcEntries.length > 0 && (
                <>
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-5">
                    <p className="text-slate-50 font-bold text-sm mb-3">Orders by Service</p>
                    <div className="flex flex-col gap-2.5">
                      {svcEntries.map(([svc, data]) => {
                        const s = SERVICES.find(x => x.name === svc)
                        return (
                          <Bar key={svc} label={`${s?.emoji ?? ''} ${svc}`} count={data.count} max={maxSvc} color="bg-orange-500" />
                        )
                      })}
                    </div>
                  </div>

                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-5">
                    <p className="text-slate-50 font-bold text-sm mb-3">Revenue by Service</p>
                    <div className="flex flex-col gap-2.5">
                      {svcEntries
                        .filter(([, d]) => d.revenue > 0)
                        .sort((a, b) => b[1].revenue - a[1].revenue)
                        .map(([svc, data]) => {
                          const s = SERVICES.find(x => x.name === svc)
                          const maxRev = Math.max(...svcEntries.map(([, d]) => d.revenue), 1)
                          return (
                            <Bar
                              key={svc}
                              label={`${s?.emoji ?? ''} ${svc}`}
                              count={data.revenue}
                              max={maxRev}
                              value={formatCurrency(data.revenue)}
                              color="bg-green-500"
                            />
                          )
                        })}
                    </div>
                  </div>
                </>
              )}

              {/* Store analytics */}
              {storeEntries.length > 0 && (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-5">
                  <p className="text-slate-50 font-bold text-sm mb-3">Store Partner — Material Volume</p>
                  <div className="flex flex-col gap-3">
                    {storeEntries.map(([, data]) => (
                      <div key={data.name}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-slate-300 text-xs font-semibold">{data.name}</p>
                          <p className="text-slate-500 text-[10px]">{data.count} orders</p>
                        </div>
                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Math.round((data.matRevenue / maxStoreMat) * 100)}%` }} />
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="text-slate-600 text-[10px]">Billed {formatCurrency(data.matRevenue)}</span>
                          <span className="text-blue-400 text-[10px]">Commission {formatCurrency(data.commission)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {svcEntries.length === 0 && (
                <p className="text-slate-600 text-sm text-center py-8">No orders in this period</p>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
