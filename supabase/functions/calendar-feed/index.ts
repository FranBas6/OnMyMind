// calendar-feed (sesión 3.7): los eventos de una persona como un calendario suscrito (iCalendar),
// para el Calendario del iPhone o del Mac. La dirección lleva el enlace secreto de Perfil:
// `…/functions/v1/calendar-feed/<enlace>.ics`. El Calendario no sabe iniciar sesión, así que no
// pasa por la puerta de JWT de Supabase (`verify_jwt = false` en config.toml): el enlace es la llave.
//
// Dentro usa `service_role` (la ponen las edge functions en el entorno, nunca sale de aquí), que es
// el único que puede llamar a `calendar_feed`. Un enlace que no existe, o que se cambió, da 404 sin
// decir por qué. El texto sale de `ical.ts`, puro y probado con Vitest.

import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

import { buildCalendar, parseFeed, tokenFromPath } from './ical.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
)

function notFound(): Response {
  return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
}

Deno.serve(async (request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } })
  }
  const token = tokenFromPath(new URL(request.url).pathname)
  if (!token) return notFound()

  const { data, error } = await supabase.rpc('calendar_feed', { p_token: token })
  if (error) {
    console.error('calendar_feed', error.message)
    return new Response('Error', { status: 500 })
  }
  const feed = parseFeed(data)
  if (!feed) return notFound()

  const body = buildCalendar(feed)
  return new Response(request.method === 'HEAD' ? null : body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="onmymind.ics"',
      // Lo pide el Calendario de vez en cuando: ni la red ni el navegador lo guardan.
      'Cache-Control': 'no-store',
    },
  })
})
