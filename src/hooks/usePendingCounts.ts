import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface PendingCounts {
  ordersNeedWorker: number      // booked + booking_paid + no worker
  labourApprovals: number       // labour_approval_pending = true
  workersPendingVerify: number  // not verified, is_active not false
  pendingPayouts: number        // unsettled labour + cancellation + bonus claims
}

export function usePendingCounts() {
  const [counts, setCounts] = useState<PendingCounts>({
    ordersNeedWorker: 0,
    labourApprovals: 0,
    workersPendingVerify: 0,
    pendingPayouts: 0,
  })

  async function refresh() {
    const [
      { count: needWorker },
      { count: labourPending },
      { count: workersPending },
      { count: unsettledLabour },
      { count: unsettledCancel },
      { count: bonusClaims },
    ] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true })
        .eq('status', 'booked').eq('booking_paid', true).is('worker_id', null),
      supabase.from('orders').select('id', { count: 'exact', head: true })
        .eq('labour_approval_pending', true),
      supabase.from('workers').select('id', { count: 'exact', head: true })
        .eq('verified', false).neq('is_active', false),
      supabase.from('orders').select('id', { count: 'exact', head: true })
        .eq('status', 'completed').eq('labour_pay_settled', false),
      supabase.from('orders').select('id', { count: 'exact', head: true })
        .eq('status', 'cancelled').eq('cancellation_pay_settled', false)
        .gt('worker_cancellation_pay', 0),
      supabase.from('bonus_claims').select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ])

    setCounts({
      ordersNeedWorker: needWorker ?? 0,
      labourApprovals: labourPending ?? 0,
      workersPendingVerify: workersPending ?? 0,
      pendingPayouts: (unsettledLabour ?? 0) + (unsettledCancel ?? 0) + (bonusClaims ?? 0),
    })
  }

  useEffect(() => {
    refresh()
    // Re-check every 30 seconds
    const interval = setInterval(refresh, 30_000)
    // Also react to DB changes
    const channel = supabase
      .channel('pending-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workers' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_claims' }, refresh)
      .subscribe()
    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [])

  return counts
}
