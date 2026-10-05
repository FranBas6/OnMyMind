import { supabase } from '@/lib/supabase/client'
import { UNDO_MS } from '@/lib/undoToast'

import { PHOTO_BUCKET } from './photos'

/**
 * Las fotos que ya no usa nadie dejan de ocupar sitio (sesión 2.8; 03 §Storage, 08 B.10). Una foto
 * se puede compartir entre un ítem y su copia («Duplicar» copia `image_path`), así que no se
 * borra la del ítem que cambia: la base dice cuáles no usa ningún ítem (`orphan_photos`, que
 * además deja lo subido hace menos de 10 minutos) y se borran con la API de Storage, que es la
 * única que puede (Supabase no deja borrarlas con SQL).
 *
 * Cuándo: un rato después de quitar o cambiar una foto, borrar un ítem o una lista, cuando ya no
 * se puede «Deshacer» (lo deshecho vuelve con su foto); y una vez al día al abrir la app, por si
 * la app se cerró antes. Si falla, no pasa nada: lo recoge la siguiente.
 */

/** La API de Storage borra como mucho unas mil rutas por llamada; con cien va sobrada. */
const REMOVE_CHUNK = 100
/** Bastante después de que se cierre el «Deshacer». */
export const CLEANUP_DELAY_MS = UNDO_MS + 25_000
const DAILY_KEY = 'omm.photoCleanupAt'
const DAY_MS = 24 * 60 * 60 * 1000

/** Borra estas rutas del bucket, de cien en cien. */
export async function removePhotos(paths: readonly string[]): Promise<void> {
  const bucket = supabase.storage.from(PHOTO_BUCKET)
  for (let start = 0; start < paths.length; start += REMOVE_CHUNK) {
    const { error } = await bucket.remove(paths.slice(start, start + REMOVE_CHUNK))
    if (error) throw error
  }
}

/** Borra tus fotos que ya no usa ningún ítem. Devuelve cuántos archivos. */
export async function removeOrphanPhotos(): Promise<number> {
  const { data, error } = await supabase.rpc('orphan_photos')
  if (error) throw error
  await removePhotos(data)
  return data.length
}

/** Borra todas tus fotos (antes de borrar la cuenta). */
export async function removeAllPhotos(): Promise<void> {
  const { data, error } = await supabase.rpc('own_photos')
  if (error) throw error
  await removePhotos(data)
}

let timer: ReturnType<typeof setTimeout> | undefined

/** Pide una limpieza dentro de un rato; varias seguidas se quedan en una. */
export function schedulePhotoCleanup(delayMs = CLEANUP_DELAY_MS): void {
  if (timer !== undefined) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = undefined
    void removeOrphanPhotos().catch(() => undefined)
  }, delayMs)
}

/** Una vez al día, al abrir la app con sesión. */
export function cleanupPhotosDaily(now: number = Date.now()): void {
  let last = 0
  try {
    last = Number(window.localStorage.getItem(DAILY_KEY) ?? 0)
  } catch {
    // Sin almacenamiento (privado, bloqueado): se intenta igual.
  }
  if (now - last < DAY_MS) return
  try {
    window.localStorage.setItem(DAILY_KEY, String(now))
  } catch {
    // Igual que arriba.
  }
  schedulePhotoCleanup()
}
