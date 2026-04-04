import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SERVICE_ROLE_KEY')!,
)

const CASHFREE_APP_ID  = Deno.env.get('CASHFREE_APP_ID')!
const CASHFREE_SECRET  = Deno.env.get('CASHFREE_SECRET_KEY')!
const TRANSACTION_FEE_RATE = 0.025

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { order_id, payment_type } = await req.json() as {
      order_id: string
      payment_type: 'booking' | 'final'
    }

    if (!order_id || !['booking', 'final'].includes(payment_type)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch order from DB
    const { data: order, error: dbErr } = await supabase
      .from('orders')
      .select('id, customer_id, customer_name, customer_phone, booking_amt, total_quote, booking_paid, final_paid')
      .eq('id', order_id)
      .single()

    if (dbErr || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (payment_type === 'booking' && order.booking_paid) {
      return new Response(JSON.stringify({ error: 'Booking already paid' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (payment_type === 'final' && order.final_paid) {
      return new Response(JSON.stringify({ error: 'Final payment already made' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Calculate amount with transaction fee
    const baseAmount = payment_type === 'booking'
      ? (order.booking_amt as number)
      : (order.total_quote as number)

    if (!baseAmount) {
      return new Response(JSON.stringify({ error: 'Amount not available' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const amount = Math.round(baseAmount * (1 + TRANSACTION_FEE_RATE) * 100) / 100

    // Unique Cashfree order ID: prefix with payment type to avoid collision
    const cfOrderId = `${payment_type === 'booking' ? 'BK' : 'FN'}-${order_id}`

    const appUrl = Deno.env.get('APP_URL') || 'https://app.getmypro.in'

    const payload = {
      order_id:       cfOrderId,
      order_amount:   amount,
      order_currency: 'INR',
      customer_details: {
        customer_id:    order.customer_id,
        customer_name:  order.customer_name,
        customer_phone: order.customer_phone,
      },
      order_meta: {
        return_url: `${appUrl}/customer/orders/${order_id}?payment=${payment_type}&status={order_status}`,
        notify_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/cashfree-webhook`,
      },
      order_tags: {
        internal_order_id: order_id,
        payment_type,
      },
    }

    const cfRes = await fetch('https://api.cashfree.com/pg/orders', {
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        'x-api-version':  '2023-08-01',
        'x-client-id':    CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET,
      },
      body: JSON.stringify(payload),
    })

    const cfData = await cfRes.json()

    if (!cfRes.ok) {
      console.error('Cashfree error:', cfData)
      return new Response(JSON.stringify({ error: cfData.message || 'Payment gateway error' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      payment_session_id: cfData.payment_session_id,
      cf_order_id:        cfData.cf_order_id,
      order_id:           cfData.order_id,
      amount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('cashfree-create-order error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
