import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendNotification } from '../_shared/fcm.ts'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SERVICE_ROLE_KEY')!,
)

async function getWorkerToken(workerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('workers').select('fcm_token').eq('id', workerId).single()
  return data?.fcm_token ?? null
}

async function getCustomerToken(customerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles').select('fcm_token').eq('id', customerId).single()
  return data?.fcm_token ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { type, record: order, old_record: old } = await req.json()

    // ── NEW ORDER: booking payment confirmed → broadcast to available workers ──
    if (type === 'UPDATE' && !old.booking_paid && order.booking_paid && !order.worker_id) {
      // Notify customer: booking confirmed
      if (order.customer_id) {
        const token = await getCustomerToken(order.customer_id)
        if (token) await sendNotification(
          token,
          'Booking Confirmed! 🎉',
          `We're finding the best Pro for your ${order.service} job. You'll be notified when one is assigned.`,
          { screen: 'order', orderId: order.id },
          'high',
        )
      }

      // Broadcast to available workers
      const { data: workers } = await supabase
        .from('workers')
        .select('fcm_token, service_categories')
        .eq('is_online', true)
        .eq('verified', true)
        .eq('is_active', true)
        .not('fcm_token', 'is', null)

      const matching = (workers ?? []).filter(w =>
        !w.service_categories?.length || w.service_categories.includes(order.service)
      )

      await Promise.all(matching.map(w =>
        sendNotification(
          w.fcm_token,
          'New Job Available 🔧',
          `${order.service} · ₹100 visiting charge guaranteed`,
          { screen: 'job', orderId: order.id, fullscreen: 'true' },
          'high',
          true, // data-only so native JobNotificationService shows full-screen intent
        )
      ))
    }

    // ── UPDATE events ─────────────────────────────────────────────
    if (type === 'UPDATE') {

      // ── WORKER NOTIFICATIONS ──────────────────────────────────────

      // W1. Job assigned to a worker (worker accepted from pool — no alarm, they already know)
      if (!old.worker_id && order.worker_id) {
        const token = await getWorkerToken(order.worker_id)
        if (token) await sendNotification(
          token,
          'Job Assigned to You! 🔧',
          `${order.service} — tap to view and head out`,
          { screen: 'job', orderId: order.id },
          'high',
        )
      }

      // W2. Preferred worker requested
      if (!old.preferred_worker_id && order.preferred_worker_id) {
        const token = await getWorkerToken(order.preferred_worker_id)
        if (token) await sendNotification(
          token,
          'A customer requested YOU! 🎯',
          `${order.service} — they specifically want you`,
          { screen: 'job', orderId: order.id, fullscreen: 'true' },
          'high',
          true, // data-only → full-screen intent
        )
      }

      // W3. Quote sent to customer
      if (old.status !== 'quote_sent' && order.status === 'quote_sent' && order.worker_id) {
        const token = await getWorkerToken(order.worker_id)
        if (token) await sendNotification(
          token,
          'Quote Sent to Customer ✓',
          `Your quote for ${order.service} has been sent — waiting for customer payment`,
          { screen: 'job', orderId: order.id },
          'normal',
        )
      }

      // W4. Customer paid — job moves to in_progress
      if (old.status !== 'in_progress' && order.status === 'in_progress' && order.worker_id) {
        const token = await getWorkerToken(order.worker_id)
        if (token) await sendNotification(
          token,
          'Payment Received — Start Work! 💪',
          `${order.customer_name} has paid. Head to the job site now.`,
          { screen: 'job', orderId: order.id },
          'high',
        )
      }

      // W5. Quote rejected
      if (old.status === 'quote_sent' && order.status === 'cancelled' && order.worker_id) {
        const token = await getWorkerToken(order.worker_id)
        if (token) await sendNotification(
          token,
          'Quote Declined',
          `${order.customer_name} declined the quote. Visit charge will be credited.`,
          { screen: 'earnings' },
          'normal',
        )
      }

      // W6. Payment settled by admin
      if (!old.labour_pay_settled && order.labour_pay_settled && order.worker_id) {
        const token = await getWorkerToken(order.worker_id)
        if (token) await sendNotification(
          token,
          'Payment Credited 💰',
          `₹${(order.quote_labour ?? 0) + 100} for your ${order.service} job sent to your UPI`,
          { screen: 'earnings' },
          'normal',
        )
      }

      // ── CUSTOMER NOTIFICATIONS ────────────────────────────────────

      // C1. Booking confirmed + searching for a Pro (booking_paid just turned true, no worker yet)
      if (!old.booking_paid && order.booking_paid && !order.worker_id && order.customer_id) {
        const token = await getCustomerToken(order.customer_id)
        if (token) await sendNotification(
          token,
          'Booking Confirmed! 🎉',
          `We're finding the best Pro for your ${order.service}. Sit tight!`,
          { screen: 'order', orderId: order.id },
          'high',
        )
      }

      // C2. Pro assigned — on the way
      if (!old.worker_id && order.worker_id && order.customer_id) {
        const token = await getCustomerToken(order.customer_id)
        if (token) await sendNotification(
          token,
          'Pro is on the way! 🚗',
          `${order.worker_name} has accepted your ${order.service} job and is heading to you`,
          { screen: 'order', orderId: order.id },
          'high',
        )
      }

      // C3. Pro arrived — inspection started
      if (old.status !== 'inspecting' && order.status === 'inspecting' && order.customer_id) {
        const token = await getCustomerToken(order.customer_id)
        if (token) await sendNotification(
          token,
          'Pro Has Arrived 📍',
          `${order.worker_name ?? 'Your Pro'} is at your location and inspecting the job`,
          { screen: 'order', orderId: order.id },
          'high',
        )
      }

      // C4. Quote ready — action needed
      if (old.status !== 'quote_sent' && order.status === 'quote_sent' && order.customer_id) {
        const token = await getCustomerToken(order.customer_id)
        if (token) await sendNotification(
          token,
          'Your Quote is Ready! 📋',
          `Open the app to review and approve the quote for your ${order.service} job`,
          { screen: 'order', orderId: order.id },
          'high',
        )
      }

      // C5. Work in progress — payment received, work started
      if (old.status !== 'in_progress' && order.status === 'in_progress' && order.customer_id) {
        const token = await getCustomerToken(order.customer_id)
        if (token) await sendNotification(
          token,
          'Work Has Started! 🔨',
          `${order.worker_name ?? 'Your Pro'} has started working on your ${order.service}`,
          { screen: 'order', orderId: order.id },
          'normal',
        )
      }

      // C6. Materials collected from store
      if (old.status !== 'material_collected' && order.status === 'material_collected' && order.customer_id) {
        const token = await getCustomerToken(order.customer_id)
        if (token) await sendNotification(
          token,
          'Materials Collected ✅',
          `${order.worker_name ?? 'Your Pro'} has picked up the required materials and is on the way`,
          { screen: 'order', orderId: order.id },
          'normal',
        )
      }

      // C7. Work done, waiting for completion OTP
      if (old.status !== 'done_uploaded' && order.status === 'done_uploaded' && order.customer_id) {
        const token = await getCustomerToken(order.customer_id)
        if (token) await sendNotification(
          token,
          'Work Done — Verify Now! 🔐',
          `${order.worker_name ?? 'Your Pro'} has finished the job. Open the app to enter the OTP and confirm`,
          { screen: 'order', orderId: order.id },
          'high',
        )
      }

      // C8. Job completed
      if (old.status !== 'completed' && order.status === 'completed' && order.customer_id) {
        const token = await getCustomerToken(order.customer_id)
        if (token) await sendNotification(
          token,
          'Job Complete! 🎉',
          `Your ${order.service} is done. Tap to rate your Pro`,
          { screen: 'order', orderId: order.id },
          'normal',
        )
      }

      // C9. Job cancelled
      if (old.status !== 'cancelled' && order.status === 'cancelled' && order.customer_id) {
        const token = await getCustomerToken(order.customer_id)
        if (token) await sendNotification(
          token,
          'Order Cancelled',
          `Your ${order.service} booking has been cancelled. Contact us if you need help.`,
          { screen: 'order', orderId: order.id },
          'normal',
        )
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('handle-order-changes:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
