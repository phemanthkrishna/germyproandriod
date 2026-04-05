import { load } from '@cashfreepayments/cashfree-js'
import { supabase } from './supabase'

export type PaymentType = 'booking' | 'final'

let _cashfree: Awaited<ReturnType<typeof load>> | null = null

async function getSdk() {
  if (!_cashfree) {
    const mode = (import.meta.env.VITE_CASHFREE_MODE as 'production' | 'sandbox') || 'production'
    _cashfree = await load({ mode })
  }
  return _cashfree
}

/**
 * Creates a Cashfree payment session and opens the checkout.
 * Redirects the user to Cashfree; on completion they are sent back
 * to /customer/orders/{orderId}?payment=<type>&status={order_status}
 */
export async function openCashfreeCheckout(orderId: string, paymentType: PaymentType) {
  const { data, error } = await supabase.functions.invoke('cashfree-create-order', {
    body: { order_id: orderId, payment_type: paymentType },
  })
  if (error) throw new Error(error.message || 'Failed to create payment session')

  const { payment_session_id } = data as { payment_session_id: string }
  const cashfree = await getSdk()
  cashfree.checkout({ paymentSessionId: payment_session_id, redirectTarget: '_self' })
}
