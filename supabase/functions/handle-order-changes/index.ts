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

    // ── UPDATE: booking payment confirmed → broadcast to available workers ──
    if (type === 'UPDATE' && !old.booking_paid && order.booking_paid && !order.worker_id) {
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
          { screen: 'job', orderId: order.id },
          'normal',
        )
      ))
    }

    // ── UPDATE events ─────────────────────────────────────────────
    if (type === 'UPDATE') {

      // 1. Job auto-assigned to a worker (worker_id was null, now set)
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

      // 2. Preferred worker requested
      if (!old.preferred_worker_id && order.preferred_worker_id) {
        const token = await getWorkerToken(order.preferred_worker_id)
        if (token) await sendNotification(
          token,
          'A customer requested YOU! 🎯',
          `${order.service} — they specifically want you`,
          { screen: 'job', orderId: order.id },
          'high',
        )
      }

      // 3. Status just moved to quote_sent → notify worker (covers both direct quote + admin approval paths)
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

      // 4. Customer paid — job moves to in_progress
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

      // 5. Quote rejected — cancelled after quote was sent
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

      // 6. Payment settled by admin
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

      // ── Customer notifications ─────────────────────────────────────

      // C1. Worker assigned — notify customer
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

      // C2. Quote ready — notify customer (mat_cost_admin set, status quote_sent)
      if (old.status !== 'quote_sent' && order.status === 'quote_sent' && order.customer_id) {
        const token = await getCustomerToken(order.customer_id)
        if (token) await sendNotification(
          token,
          'Your Quote is Ready! 📋',
          `Open the app to review and pay for your ${order.service} job`,
          { screen: 'order', orderId: order.id },
          'high',
        )
      }

      // C3. Job completed — notify customer
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
