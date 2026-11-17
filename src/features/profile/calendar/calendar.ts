/**
 * El enlace del Calendario del iPhone (3.7, diseño 21, C1–C7 y D6). Apunta a la edge function
 * `calendar-feed` de Supabase, no a la app: el Calendario lo consulta solo, sin sesión, y así no
 * cambia aunque cambie la dirección de la app.
 */

/** `https://<proyecto>.supabase.co/functions/v1/calendar-feed/<enlace>.ics`. */
export function calendarFeedUrl(token: string, supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/calendar-feed/${token}.ics`
}

/**
 * Lo mismo con `webcal://`, que el iPhone y el Mac abren en el Calendario para suscribirse. Es el
 * que se enseña y se copia: «Añadir calendario suscrito» también lo acepta.
 */
export function subscribeUrl(feedUrl: string): string {
  return feedUrl.replace(/^https?:\/\//, 'webcal://')
}
