// FCM HTTP v1 API — uses service account JSON stored in FCM_SERVICE_ACCOUNT secret

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  const binary = atob(base64)
  const buf = new ArrayBuffer(binary.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i)
  return buf
}

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function getAccessToken(sa: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const enc = (obj: object) => b64url(new TextEncoder().encode(JSON.stringify(obj)).buffer as ArrayBuffer)
  const header  = enc({ alg: 'RS256', typ: 'JWT' })
  const payload = enc({
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  })
  const input = `${header}.${payload}`
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input))
  const jwt = `${input}.${b64url(sig)}`

  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json()
  return data.access_token
}

export async function sendNotification(
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string> = {},
  priority: 'high' | 'normal' = 'normal',
  dataOnly = false,
): Promise<void> {
  const sa = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT')!)
  const token = await getAccessToken(sa)

  const isHighPriority = priority === 'high'
  // job_alerts channel (ringtone) is ONLY for fullscreen data-only messages.
  // All regular notifications use 'general' regardless of priority.
  const channelId = 'general'

  const messagePayload: Record<string, any> = {
    token: fcmToken,
    android: {
      priority: isHighPriority ? 'HIGH' : 'NORMAL',
    },
    data: {
      ...data,
      title,
      body,
    },
  }

  // Data-only mode: used for worker job alerts so the custom native service
  // (JobNotificationService) handles full-screen intent display.
  // All other messages include notification payload for standard display.
  if (!dataOnly) {
    messagePayload.notification = { title, body }
    messagePayload.android.notification = {
      sound:        'default',
      channel_id:   channelId,
      default_sound: true,
      default_vibrate_timings: true,
      notification_priority: isHighPriority ? 'PRIORITY_HIGH' : 'PRIORITY_DEFAULT',
      visibility: isHighPriority ? 'PUBLIC' : 'PRIVATE',
    }
  }

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ message: messagePayload }),
    },
  )
  if (!res.ok) {
    const err = await res.text()
    console.error('FCM send failed:', err)
  }
}
