import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { BottomNav } from '../../components/BottomNav'
import { StatusBadge } from '../../components/StatusBadge'
import { formatDate, formatCurrency } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { Briefcase, DollarSign, User, History, Trophy, Loader2 } from 'lucide-react'
import type { Order } from '../../types'

const NAV = [
  { to: '/worker',          icon: Briefcase,  label: 'Jobs'     },
  { to: '/worker/progress', icon: Trophy,     label: 'Progress', activeColor: '#F47820' },
  { to: '/worker/earnings', icon: DollarSign, label: 'Earnings' },
  { to: '/worker/history',  icon: History,    label: 'History'  },
  { to: '/worker/profile',  icon: User,       label: 'Profile'  },
]

const WORKER_VISIT = 100
const PAGE_SIZE = 20

export default function WorkerHistory() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)

  const fetchPage = useCallback(async (pageIndex: number, append: boolean) => {
    if (!session?.id) return
    if (append) setLoadingMore(true)
    else setLoading(true)

    const from = pageIndex * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('worker_id', session.id)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (!error && data) {
      setOrders(prev => append ? [...prev, ...data as Order[]] : data as Order[])
      setHasMore(data.length === PAGE_SIZE)
    }
    setLoading(false)
    setLoadingMore(false)
  }, [session?.id])

  useEffect(() => {
    setPage(0)
    setOrders([])
    fetchPage(0, false)
  }, [session?.id])

  function loadMore() {
    const next = page + 1
    setPage(next)
    fetchPage(next, true)
  }

  function getAmount(o: Order) {
    if (o.status === 'completed') return (o.quote_labour || 0) + WORKER_VISIT
    if (o.status === 'cancelled' && (o.worker_cancellation_pay || 0) > 0) return o.worker_cancellation_pay || 0
    if (o.quote_labour) return o.quote_labour
    return null
  }

  function getAmountLabel(o: Order) {
    if (o.status === 'completed') return 'Labour + visit'
    if (o.status === 'cancelled') return 'Visit charge'
    return 'Est. labour'
  }

  return (
    <div className="page-content px-5 py-6">
      <h1 className="text-2xl font-black font-heading text-slate-50 mb-5">Work History</h1>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-slate-400" size={28} />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">No jobs yet</div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {orders.map(o => {
              const amt = getAmount(o)
              return (
                <button
                  key={o.id}
                  onClick={() => navigate(`/worker/job/${o.id}`)}
                  className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between text-left w-full"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{o.service_emoji}</span>
                      <p className="text-slate-50 font-semibold text-sm truncate">{o.service}</p>
                    </div>
                    <p className="text-slate-500 text-xs mb-1">{o.id} · {formatDate(o.created_at)}</p>
                    <p className="text-slate-600 text-xs truncate">{o.address}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 ml-3 shrink-0">
                    <StatusBadge status={o.status} />
                    {amt !== null && (
                      <div className="text-right">
                        <p className="text-green-400 font-bold text-sm">{formatCurrency(amt)}</p>
                        <p className="text-slate-600 text-xs">{getAmountLabel(o)}</p>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-4 w-full py-3 rounded-xl border border-slate-700 text-slate-400 text-sm font-semibold flex items-center justify-center gap-2"
            >
              {loadingMore ? <><Loader2 size={16} className="animate-spin" /> Loading...</> : 'Load more'}
            </button>
          )}
        </>
      )}

      <BottomNav items={NAV} />
    </div>
  )
}
