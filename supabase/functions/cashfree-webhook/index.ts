import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SERVICE_ROLE_KEY')!,
)

const CASHFREE_SECRET = Deno.env.get('CASHFREE_SECRET_KEY')!

async function verifySignature(rawBody: string, timestamp: string, signature: string): Promise<boolean> {
  const data = timestamp + rawBody
  const key  = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(CASHFREE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const computed = btoa(String.fromCharCode(...new Uint8Array(mac)))
  return computed === signature
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const rawBody  = await req.text()
  const timestamp = req.headers.get('x-webhook-timestamp') ?? ''
  const signature = req.headers.get('x-webhook-signature') ?? ''

  // Verify Cashfree signature
  const valid = await verifySignature(rawBody, timestamp, signature)
  if (!valid) {
    console.error('Invalid webhook signature')
    return new Response('Unauthorized', { status: 401 })
  }

  let event: Record<string, any>
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  const eventType   = event?.type as string           // e.g. "PAYMENT_SUCCESS_WEBHOOK"
  const orderData   = event?.data?.order   as Record<string, any>
  const paymentData = event?.data?.payment as Record<string, any>

  // Only process successful payments
  if (eventType !== 'PAYMENT_SUCCESS_WEBHOOK') {
    return new Response('Ignored', { status: 200 })
  }

  const cfOrderId: string = orderData?.order_id ?? ''  // e.g. "BK-ORD-abc123" or "FN-ORD-abc123"
  const paymentStatus: string = paymentData?.payment_status ?? ''

  if (paymentStatus !== 'SUCCESS') {
    return new Response('Payment not successful', { status: 200 })
  }

  // Parse payment type and internal order ID from cf order ID
  const bookingMatch = cfOrderId.match(/^BK-(.+)$/)
  const finalMatch   = cfOrderId.match(/^FN-(.+)$/)

  if (!bookingMatch && !finalMatch) {
    console.error('Unknown order ID format:', cfOrderId)
    return new Response('Unknown order format', { status: 200 })
  }

  const internalOrderId = (bookingMatch ?? finalMatch)![1]
  const paymentType = bookingMatch ? 'booking' : 'final'

  // Update the order in DB
  const updatePayload = paymentType === 'booking'
    ? { booking_paid: true }
    : { final_paid: true, status: 'in_progress' }

  const { error } = await supabase
    .from('orders')
    .update(updatePayload)
    .eq('id', internalOrderId)

  if (error) {
    console.error('DB update failed:', error)
    return new Response('DB error', { status: 500 })
  }

  console.log(`Payment confirmed: ${paymentType} for order ${internalOrderId}`)
  return new Response('OK', { status: 200 })
})
