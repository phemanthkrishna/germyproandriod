import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendNotification } from '../_shared/fcm.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface CampaignPayload {
  title: string
  body: string
  target_role: 'all' | 'customer' | 'worker'
  target_city?: string | null
  target_service?: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let payload: CampaignPayload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders })
  }

  const { title, body, target_role, target_city, target_service } = payload

  if (!title?.trim() || !body?.trim()) {
    return new Response(JSON.stringify({ error: 'title and body are required' }), { status: 400, headers: corsHeaders })
  }

  const tokens: string[] = []

  // ── Collect customer FCM tokens ──
  if (target_role === 'all' || target_role === 'customer') {
    const { data: customers } = await supabase
      .from('profiles')
      .select('fcm_token')
      .eq('role', 'customer')
      .not('fcm_token', 'is', null)
    for (const c of customers ?? []) {
      if (c.fcm_token) tokens.push(c.fcm_token)
    }
  }

  // ── Collect worker FCM tokens ──
  if (target_role === 'all' || target_role === 'worker') {
    let q = supabase
      .from('workers')
      .select('fcm_token')
      .eq('is_active', true)
      .not('fcm_token', 'is', null)
    if (target_city) q = q.eq('city', target_city)
    if (target_service) q = q.contains('service_categories', [target_service])
    const { data: workers } = await q
    for (const w of workers ?? []) {
      if (w.fcm_token) tokens.push(w.fcm_token)
    }
  }

  // ── Deduplicate tokens ──
  const uniqueTokens = [...new Set(tokens)]

  // ── Send in parallel batches of 50 ──
  let sent = 0
  const BATCH = 50
  for (let i = 0; i < uniqueTokens.length; i += BATCH) {
    const batch = uniqueTokens.slice(i, i + BATCH)
    await Promise.allSettled(
      batch.map(token =>
        sendNotification(token, title.trim(), body.trim(), { screen: 'home' }, 'normal')
          .then(() => { sent++ })
          .catch(() => {/* stale token — skip */})
      )
    )
  }

  // ── Log the campaign ──
  await supabase.from('campaign_logs').insert({
    title: title.trim(),
    body: body.trim(),
    target_role,
    target_city: target_city ?? null,
    target_service: target_service ?? null,
    sent_count: sent,
  })

  return new Response(
    JSON.stringify({ sent_count: sent }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
