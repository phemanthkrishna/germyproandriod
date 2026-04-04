import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendNotification } from '../_shared/fcm.ts'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  'https://czhffuzqxkhxfmvjucee.supabase.co',
  Deno.env.get('SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { type, record: claim, old_record: old } = await req.json()

    // Bonus claim marked as paid
    if (type === 'UPDATE' && old.status !== 'paid' && claim.status === 'paid') {
      const { data: worker } = await supabase
        .from('workers').select('fcm_token').eq('id', claim.worker_id).single()

      if (worker?.fcm_token) {
        await sendNotification(
          worker.fcm_token,
          'Bonus Credited! 🏅',
          `Your ${claim.milestone_badge} bonus of ₹${claim.amount} has been sent to your UPI`,
          { screen: 'progress' },
          'normal',
        )
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('handle-bonus-changes:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
