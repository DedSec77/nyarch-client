// Supabase Edge Function: send-push
// ----------------------------------
// Sends an encrypted Web Push notification to every push subscription owned by
// a given user. Called server-side by the database (via pg_net) whenever a
// notification / DM is created, so pushes are delivered even when the user's
// browser tab is closed.
//
// DEPLOY:
//   supabase functions deploy send-push --no-verify-jwt
//
// SECRETS (set once):
//   supabase secrets set VAPID_PUBLIC_KEY=...   VAPID_PRIVATE_KEY=...   VAPID_SUBJECT=mailto:you@example.com
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// Generate a VAPID key pair once with:  npx web-push generate-vapid-keys
// Put the PUBLIC key into the frontend build as VITE_VAPID_PUBLIC_KEY too.

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@nyarch.local'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

interface Payload {
  user_id: string
  title?: string
  body?: string
  url?: string
  tag?: string | null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), { status: 500 })
  }

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }

  if (!payload.user_id) {
    return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400 })
  }

  // Fetch all of the recipient's push subscriptions.
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', payload.user_id)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  const notification = JSON.stringify({
    title: payload.title ?? 'nyarch',
    body: payload.body ?? '',
    url: payload.url ?? '/',
    tag: payload.tag ?? undefined,
    icon: '/favicon.svg',
  })

  let sent = 0
  const stale: string[] = []

  await Promise.all(
    subs.map(async (s) => {
      const subscription = {
        endpoint: s.endpoint as string,
        keys: { p256dh: s.p256dh as string, auth: s.auth as string },
      }
      try {
        await webpush.sendNotification(subscription, notification)
        sent++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        // 404/410 => subscription gone; clean it up.
        if (status === 404 || status === 410) stale.push(s.id as string)
      }
    }),
  )

  if (stale.length) {
    await admin.from('push_subscriptions').delete().in('id', stale)
  }

  return new Response(JSON.stringify({ sent, removed: stale.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
