import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Order } from '../types'

export function useOrders(filter: Record<string, string>) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchOrders() {
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false })
    for (const [col, val] of Object.entries(filter)) {
      query = query.eq(col, val)
    }
    const { data, error } = await query
    if (error) console.error('Failed to load orders:', error.message)
    else if (data) setOrders(data as Order[])
    setLoading(false)
  }

  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel('orders-' + Object.keys(filter).join('-'))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => fetchOrders())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [JSON.stringify(filter)])

  return { orders, loading, refetch: fetchOrders }
}

export function useOrder(orderId: string) {
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchOrder() {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()
    if (error) console.error('Failed to load order:', error.message)
    else if (data) setOrder(data as Order)
    setLoading(false)
  }

  useEffect(() => {
    fetchOrder()

    // Realtime subscription for live updates
    const channel = supabase
      .channel('order-' + orderId)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => { if (payload.new.id === orderId) setOrder(payload.new as Order) }
      )
      .subscribe()

    // Refetch when app comes back to foreground (covers cases where realtime
    // missed an update while the screen was off or app was backgrounded)
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') fetchOrder()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [orderId])

  return { order, loading, refetch: fetchOrder }
}
