import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useCity } from '../../context/CityContext'
import { StatusBadge } from '../../components/StatusBadge'
import { formatDate } from '../../lib/utils'
import type { Order } from '../../types'

const FILTERS = ['All', 'Assign Worker', 'In Progress', 'Done']

const FILTER_MAP: Record<string, (o: Order) => boolean> = {
  'All': () => true,
  'Assign Worker': o => o.status === 'booked' && !o.worker_id,
  'In Progress': o => ['in_progress', 'worker_visiting', 'material_collected'].includes(o.status),
  'Done': o => ['done_uploaded', 'completed'].includes(o.status),
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { selectedCity } = useCity()
  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrders()
    const channel = supabase
      .channel('admin-dashboard-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => fetchOrders())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => fetchOrders())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedCity])

  async function fetchOrders() {
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (selectedCity) query = query.eq('customer_city', selectedCity)
    const { data, error } = await query
    if (error) console.error('Failed to load orders:', error.message)
    setOrders((data as Order[]) || [])
    setLoading(false)
  }

  const q = search.toLowerCase().trim()
  const filtered = orders
    .filter(FILTER_MAP[filter] || (() => true))
    .filter(o => !q || [o.customer_name, o.customer_phone, o.id, o.worker_name || ''].some(v => v.toLowerCase().includes(q)))
  const needWorker = orders.filter(o => o.status === 'booked' && !o.worker_id).length
  const active = orders.filter(o => !['completed', 'cancelled'].includes(o.status)).length
  const completed = orders.filter(o => o.status === 'completed').length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-black font-heading text-slate-50">
          {selectedCity ? `${selectedCity} — Orders` : 'All Orders'}
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label="Need Worker" value={needWorker} urgent={needWorker > 0} />
        <StatCard label="Active" value={active} />
        <StatCard label="Completed" value={completed} />
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by customer, phone, order ID, worker…"
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-50 placeholder-slate-600 text-sm outline-none focus:border-blue-500 mb-4"
      />

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              filter === f ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <div className="text-center text-slate-500 py-10">Loading...</div>}

      <div className="flex flex-col gap-3">
        {filtered.map(o => (
          <button
            key={o.id}
            onClick={() => navigate(`/admin/orders/${o.id}`)}
            className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-left btn-press w-full"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-2xl">{o.service_emoji}</span>
                <div className="min-w-0">
                  <p className="font-bold text-slate-50 truncate">{o.service}</p>
                  <p className="text-slate-500 text-xs truncate">
                    {o.customer_name} · {o.customer_city || '—'} · {formatDate(o.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <StatusBadge status={o.status} />
              </div>
            </div>
          </button>
        ))}
        {!loading && filtered.length === 0 && (
          <p className="text-slate-600 text-sm text-center py-10">
            No orders{selectedCity ? ` in ${selectedCity}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, urgent }: { label: string; value: number; urgent?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 text-center border ${urgent ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-800 border-slate-700'}`}>
      <p className={`text-2xl font-black font-heading ${urgent ? 'text-red-400' : 'text-slate-50'}`}>{value}</p>
      <p className="text-slate-500 text-xs mt-0.5">{label}</p>
    </div>
  )
}
