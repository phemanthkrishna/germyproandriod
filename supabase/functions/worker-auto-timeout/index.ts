// Runs every 30 minutes via pg_cron.
// Checks:
//   A. Online workers inactive 4+ hours (no active job) → set offline + notify
//   B. Offline workers 2+ days → send warning notification
//   C. Offline workers 3+ days → pause account + notify (contact admin to reactivate)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendNotification } from '../_shared/fcm.ts'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  'https://czhffuzqxkhxfmvjucee.supabase.co',
  Deno.env.get('SERVICE_ROLE_KEY')!,
)

const ACTIVE_STATUSES = ['booked', 'inspecting', 'quote_sent', 'in_progress', 'material_collected', 'done_uploaded']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const now = Date.now()
  const fourHoursAgo  = new Date(now - 4  * 60 * 60 * 1000).toISOString()
  const twoDaysAgo    = new Date(now - 2  * 24 * 60 * 60 * 1000).toISOString()
  const threeDaysAgo  = new Date(now - 3  * 24 * 60 * 60 * 1000).toISOString()

  try {

    // ── A: Online but inactive 4+ hours ─────────────────────────
    const { data: stale } = await supabase
      .from('workers')
      .select('id, fcm_token')
      .eq('is_online', true)
      .eq('is_active', true)
      .lt('last_active_at', fourHoursAgo)

    for (const w of stale ?? []) {
      // Skip if worker has an active job — job resets the timer
      const { data: job } = await supabase
        .from('orders')
        .select('id')
        .eq('worker_id', w.id)
        .in('status', ACTIVE_STATUSES)
        .maybeSingle()
      if (job) continue

      await supabase.from('workers').update({
        is_online: false,
        went_offline_at: new Date().toISOString(),
      }).eq('id', w.id)

      if (w.fcm_token) await sendNotification(
        w.fcm_token,
        "You've been set Offline 😴",
        'No activity for 4 hours — open the app to go back online.',
        { screen: 'jobs' },
        'normal',
      )
    }

    // ── B: Offline 2+ days warning (only send once) ──────────────
    const { data: warned } = await supabase
      .from('workers')
      .select('id, fcm_token')
      .eq('is_online', false)
      .eq('is_active', true)
      .lt('went_offline_at', twoDaysAgo)
      .gt('went_offline_at', threeDaysAgo)   // between 2 and 3 days
      .is('offline_warning_sent_at', null)   // haven't warned yet

    for (const w of warned ?? []) {
      await supabase.from('workers')
        .update({ offline_warning_sent_at: new Date().toISOString() })
        .eq('id', w.id)

      if (w.fcm_token) await sendNotification(
        w.fcm_token,
        "You've been offline for 2 days ⚠️",
        'Your account will be paused tomorrow if you stay offline. Open the app to stay active.',
        { screen: 'jobs' },
        'normal',
      )
    }

    // ── C: Offline 3+ days → pause account ──────────────────────
    const { data: paused } = await supabase
      .from('workers')
      .select('id, fcm_token')
      .eq('is_online', false)
      .eq('is_active', true)
      .lt('went_offline_at', threeDaysAgo)

    for (const w of paused ?? []) {
      await supabase.from('workers')
        .update({ is_active: false })
        .eq('id', w.id)

      if (w.fcm_token) await sendNotification(
        w.fcm_token,
        'Account Paused 🔒',
        "You've been offline for 3 days. Contact GetMyPro admin to reactivate your account.",
        { screen: 'jobs' },
        'high',
      )
    }

    return new Response(
      JSON.stringify({ stale: stale?.length, warned: warned?.length, paused: paused?.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('worker-auto-timeout:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
