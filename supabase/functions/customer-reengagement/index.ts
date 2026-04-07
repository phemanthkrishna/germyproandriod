// Runs every 2 weeks via pg_cron.
// Sends a re-engagement push notification to customers who haven't booked
// a service in the last 14 days, reminding them Getmypro is available.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendNotification } from '../_shared/fcm.ts'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SERVICE_ROLE_KEY')!,
)

// Rotate through a few messages so it doesn't feel spammy
const MESSAGES = [
  {
    title: 'Anything need fixing at home? 🔧',
    body: 'Plumbing, electrical, cleaning and more — book a verified Pro in minutes.',
  },
  {
    title: 'Your home deserves some care 🏠',
    body: 'Got a leaky tap, broken switch, or dirty AC filters? We\'ve got a Pro for that.',
  },
  {
    title: 'Don\'t let small issues become big problems 🛠️',
    body: 'Book a home service today — fast, affordable, and guaranteed quality.',
  },
  {
    title: 'We miss you! 👋',
    body: 'It\'s been a while. Book any home service on Getmypro and get it sorted today.',
  },
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

    // Get customers who have an FCM token and haven't booked in 14+ days
    // (or have never booked)
    const { data: customers, error } = await supabase
      .from('profiles')
      .select('id, fcm_token')
      .eq('role', 'customer')
      .not('fcm_token', 'is', null)

    if (error) throw error

    // For each customer, check their last order date
    let notified = 0
    for (const customer of customers ?? []) {
      const { data: lastOrder } = await supabase
        .from('orders')
        .select('created_at')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Skip if they have a recent booking
      if (lastOrder && lastOrder.created_at > fourteenDaysAgo) continue

      // Pick message based on customer id hash so different customers get different messages
      const msgIndex = parseInt(customer.id.replace(/-/g, '').slice(0, 8), 16) % MESSAGES.length
      const msg = MESSAGES[msgIndex]

      await sendNotification(
        customer.fcm_token,
        msg.title,
        msg.body,
        { screen: 'home' },
        'normal',
      )
      notified++
    }

    console.log(`Re-engagement: notified ${notified} customers`)
    return new Response(
      JSON.stringify({ ok: true, notified }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('customer-reengagement:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
