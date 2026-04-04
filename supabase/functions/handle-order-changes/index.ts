import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendNotification } from '../_shared/fcm.ts'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  'https://czhffuzqxkhxfmvjucee.supabase.co',
  Deno.env.get('SERVICE_ROLE_KEY')!,
)

async function getWorkerToken(workerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('workers').select('fcm_token').eq('id', workerId).single()
  return data?.fcm_token ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { type, record: order, old_record: old } = await req.json()

    // ── INSERT: new unassigned job ────────────────────────────────
    if (type === 'INSERT' && order.status === 'booked' && !order.worker_id) {
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

      // 3. Labour quote approved by admin
      if (old.labour_approval_pending && !order.labour_approval_pending && order.worker_id) {
        const token = await getWorkerToken(order.worker_id)
        if (token) await sendNotification(
          token,
          'Quote Approved ✓',
          `Your ₹${order.labour_pending_amount} charge was approved — quote sent to customer`,
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
