import { supabase } from '@/lib/supabase/client'

/** Bucket privado de las fotos (03 §Storage). */
export const PHOTO_BUCKET = 'item-images'

/** La foto del detalle, de 800 px de ancho como mucho, y la miniatura cuadrada de las filas. */
const FULL_WIDTH = 800
const THUMB_SIZE = 200
const QUALITY = 0.82
/** Las URLs firmadas duran una semana; la caché las da por buenas seis días. */
export const SIGNED_URL_SECONDS = 7 * 24 * 60 * 60

/** Si un ítem tiene imagen que enseñar: su foto propia o la de la página de su enlace. */
export function hasThumb(item: { imagePath: string | null; imageUrl: string | null }): boolean {
  return item.imagePath !== null || item.imageUrl !== null
}

/** `{user}/{item}/{uuid}.webp` → `{user}/{item}/{uuid}-thumb.webp`. */
export function thumbPath(path: string): string {
  return path.replace(/(\.[a-z0-9]+)$/i, '-thumb$1')
}

interface Resized {
  full: Blob
  thumb: Blob
  extension: 'webp' | 'jpg'
}

/**
 * Reduce la foto en el cliente antes de subirla (las transformaciones de Storage son del plan Pro):
 * 800 px de ancho para el detalle y un cuadrado de 200 px recortado al centro para las filas. En
 * WebP si el navegador sabe hacerlo; si no (Safari antiguo), en JPEG.
 */
export async function resizePhoto(file: Blob): Promise<Resized> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, FULL_WIDTH / bitmap.width)
    const full = await draw(
      bitmap,
      Math.round(bitmap.width * scale),
      Math.round(bitmap.height * scale),
    )
    const side = Math.min(bitmap.width, bitmap.height)
    const thumb = await draw(bitmap, THUMB_SIZE, THUMB_SIZE, {
      x: (bitmap.width - side) / 2,
      y: (bitmap.height - side) / 2,
      size: side,
    })
    const extension = full.type === 'image/webp' && thumb.type === 'image/webp' ? 'webp' : 'jpg'
    return { full, thumb, extension }
  } finally {
    bitmap.close()
  }
}

async function draw(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  crop?: { x: number; y: number; size: number },
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Sin canvas')
  if (crop) context.drawImage(bitmap, crop.x, crop.y, crop.size, crop.size, 0, 0, width, height)
  else context.drawImage(bitmap, 0, 0, width, height)
  const webp = await toBlob(canvas, 'image/webp')
  return webp?.type === 'image/webp' ? webp : ((await toBlob(canvas, 'image/jpeg')) ?? fail())
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, QUALITY)
  })
}

function fail(): never {
  throw new Error('No se ha podido preparar la foto')
}

/**
 * Sube la foto de un ítem (reducida, con su miniatura) a `{user}/{item}/{uuid}.webp` y devuelve
 * la ruta, que se guarda en `items.image_path`. La carpeta del usuario es la que exige la política
 * del bucket. La de antes, si ya no la usa nadie, la borra `photoCleanup.ts` (2.8).
 */
export async function uploadItemPhoto(itemId: string, file: Blob): Promise<string> {
  const { data: auth } = await supabase.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) throw new Error('Sin sesión')

  const { full, thumb, extension } = await resizePhoto(file)
  const path = `${userId}/${itemId}/${crypto.randomUUID()}.${extension}`
  const bucket = supabase.storage.from(PHOTO_BUCKET)
  const upload = async (target: string, blob: Blob) => {
    const { error } = await bucket.upload(target, blob, { contentType: blob.type, upsert: false })
    if (error) throw error
  }
  await upload(thumbPath(path), thumb)
  await upload(path, full)
  return path
}

/** URL firmada de una foto propia: la miniatura para las filas, la grande para el detalle. */
export async function signedPhotoUrl(path: string, size: 'thumb' | 'full'): Promise<string> {
  const target = size === 'thumb' ? thumbPath(path) : path
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(target, SIGNED_URL_SECONDS)
  if (error) throw error
  return data.signedUrl
}

/**
 * Copia la foto subida de otro ítem para uno nuevo (4.4, al duplicar una lista): la grande y su
 * miniatura, a tu carpeta (`{tú}/{ítem}/{uuid}`), y se la pone. Dos ítems no comparten archivo:
 * cambiar la foto de uno borraría la del otro. La de una lista compartida contigo se puede leer
 * (`can_see_photo`), así que también se copia.
 */
export async function copyItemPhoto(itemId: string, sourcePath: string): Promise<void> {
  const { data: auth } = await supabase.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) throw new Error('Sin sesión')

  const extension = /\.([a-z0-9]+)$/i.exec(sourcePath)?.[1] ?? 'webp'
  const path = `${userId}/${itemId}/${crypto.randomUUID()}.${extension}`
  const bucket = supabase.storage.from(PHOTO_BUCKET)
  const copy = async (from: string, to: string) => {
    const { error } = await bucket.copy(from, to)
    if (error) throw error
  }
  await copy(thumbPath(sourcePath), thumbPath(path))
  await copy(sourcePath, path)
  const { error } = await supabase.from('items').update({ image_path: path }).eq('id', itemId)
  if (error) throw error
}
