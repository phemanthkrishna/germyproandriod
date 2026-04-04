import { sendNotification } from '../_shared/fcm.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { type, record: worker, old_record: old } = await req.json()

    if (type !== 'UPDATE' || !worker.fcm_token) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Account verified
    if (!old.verified && worker.verified) {
      await sendNotification(
        worker.fcm_token,
        "You're Verified! ✅",
        'Welcome to GetMyPro. Go online and start accepting jobs today!',
        { screen: 'jobs' },
        'normal',
      )
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('handle-worker-changes:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
