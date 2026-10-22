import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/client'

import type { ItemFile } from './types'

/** Bucket privado de los documentos (6.1, migración `item_files`). */
export const FILE_BUCKET = 'item-files'
/** Cuántos documentos puede tener una cosa (el trigger `item_files_limit` lo impide en la base). */
export const MAX_FILES = 5
/** 5 MB, como las fotos: el `file_size_limit` del bucket y el `check` de `size_bytes`. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024
/** Lo que dura el enlace para abrir uno; la caché lo da por bueno un poco menos. */
export const FILE_URL_SECONDS = 60 * 60

/** Un tipo de documento: su MIME, su nombre en palabras y la etiqueta de su icono. */
interface FileType {
  mime: string
  label: string
  badge: string
  extensions: readonly string[]
}

/**
 * Los que valen (Fran, 2026-10-22: PDF y oficina), en el mismo orden que `item_file_types()` en
 * la base. Las extensiones sirven cuando el sistema no dice el tipo (en el iPhone, un .docx puede
 * llegar sin él) y para el selector de archivos.
 */
const FILE_TYPES: readonly FileType[] = [
  { mime: 'application/pdf', label: 'PDF', badge: 'PDF', extensions: ['pdf'] },
  { mime: 'application/msword', label: 'Word', badge: 'DOC', extensions: ['doc'] },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'Word',
    badge: 'DOC',
    extensions: ['docx'],
  },
  { mime: 'application/vnd.ms-excel', label: 'Excel', badge: 'XLS', extensions: ['xls'] },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    label: 'Excel',
    badge: 'XLS',
    extensions: ['xlsx'],
  },
  {
    mime: 'application/vnd.ms-powerpoint',
    label: 'PowerPoint',
    badge: 'PPT',
    extensions: ['ppt'],
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    label: 'PowerPoint',
    badge: 'PPT',
    extensions: ['pptx'],
  },
  { mime: 'text/plain', label: 'Texto', badge: 'TXT', extensions: ['txt'] },
  { mime: 'text/csv', label: 'CSV', badge: 'CSV', extensions: ['csv'] },
]

/** Lo que acepta el selector de archivos: los tipos y sus extensiones. */
export const FILE_ACCEPT = [
  ...FILE_TYPES.map((type) => type.mime),
  ...FILE_TYPES.flatMap((type) => type.extensions.map((extension) => `.${extension}`)),
].join(',')

const PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'gif']

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
}

/** El tipo de un archivo por su MIME o, si no lo dice (o dice uno genérico), por su extensión. */
function typeOf(file: { name: string; type: string }): FileType | undefined {
  return (
    FILE_TYPES.find((type) => type.mime === file.type) ??
    FILE_TYPES.find((type) => type.extensions.includes(extensionOf(file.name)))
  )
}

/** El tipo de un documento ya guardado, para su icono y su línea («PDF · 1,2 MB»). */
export function fileType(mime: string): { label: string; badge: string } {
  const type = FILE_TYPES.find((entry) => entry.mime === mime)
  return type ? { label: type.label, badge: type.badge } : { label: 'Documento', badge: 'DOC' }
}

const decimal = new Intl.NumberFormat('es', { maximumFractionDigits: 1 })

/** «84 KB», «1,2 MB», «8 MB». */
export function formatFileSize(bytes: number): string {
  const megabytes = bytes / (1024 * 1024)
  if (megabytes >= 1) return `${decimal.format(Math.round(megabytes * 10) / 10)} MB`
  return `${String(Math.max(1, Math.round(bytes / 1024)))} KB`
}

/** «PDF · 1,2 MB». */
export function fileSummary(file: Pick<ItemFile, 'mime' | 'sizeBytes'>): string {
  return `${fileType(file.mime).label} · ${formatFileSize(file.sizeBytes)}`
}

/** El nombre que se guarda: sin espacios de más y, si es muy largo, cortado sin perder la extensión. */
export function fileName(name: string): string {
  const clean = name.trim().replace(/\s+/g, ' ') || 'Documento'
  if (clean.length <= 200) return clean
  const extension = extensionOf(clean)
  const tail = extension ? `.${extension}` : ''
  return `${clean.slice(0, 200 - tail.length).trimEnd()}${tail}`
}

/** Un archivo elegido, ya comprobado: lo que se sube y se guarda. */
export interface CheckedFile {
  file: File
  name: string
  mime: string
}

/**
 * Si un archivo elegido se puede adjuntar (diseño 29, X1–X3): el tipo, que no sea una foto (esa va
 * a «+ Foto») y el tamaño. Devuelve el archivo listo o el porqué, en la voz de la app.
 */
export function checkFile(
  file: File,
): { ok: true; checked: CheckedFile } | { ok: false; message: string; photo: boolean } {
  const name = fileName(file.name)
  const type = typeOf(file)
  if (!type) {
    const photo = file.type.startsWith('image/') || PHOTO_EXTENSIONS.includes(extensionOf(name))
    return {
      ok: false,
      photo,
      message: photo
        ? `“${name}” es una foto. Añádela con «+ Foto».`
        : `“${name}” no se puede adjuntar. Valen PDF, Word, Excel, PowerPoint, texto y CSV.`,
    }
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      photo: false,
      message: `“${name}” pesa ${formatFileSize(file.size)}. El máximo es 5 MB.`,
    }
  }
  return { ok: true, checked: { file, name, mime: type.mime } }
}

/** «Has llegado a 5 documentos…» (X4), o cuántos han cabido de los elegidos. */
export function roomMessage(room: number, chosen: number): string {
  if (room === 0)
    return `Has llegado a ${String(MAX_FILES)} documentos. Quita alguno para añadir otro.`
  const fit = room === 1 ? 'Solo cabía 1 más' : `Solo cabían ${String(room)} más`
  return `${fit}: se ${room === 1 ? 'ha' : 'han'} subido ${room === 1 ? 'el primero' : `los ${String(room)} primeros`} de los ${String(chosen)}.`
}

/**
 * Dónde se abre, en la hoja de opciones del móvil (F6): «en el visor del iPhone». En los demás no
 * se dice nada (cada navegador hace lo suyo).
 */
export function viewerHint(userAgent: string, maxTouchPoints: number): string | null {
  if (/iPhone|iPod/.test(userAgent)) return 'en el visor del iPhone'
  if (userAgent.includes('iPad') || (userAgent.includes('Macintosh') && maxTouchPoints > 1)) {
    return 'en el visor del iPad'
  }
  return null
}

/**
 * El nombre del archivo en Storage: el suyo, con lo que Storage no admite cambiado (sin tildes, y
 * solo letras, números, espacios y `._-()`). Así, abierto o descargado, se llama como el original.
 */
export function storageName(name: string): string {
  const plain = name.normalize('NFD').replace(/\p{M}/gu, '')
  const safe = plain.replace(/[^A-Za-z0-9 ._()-]/g, '-').replace(/-{2,}/g, '-')
  return safe.trim() || 'documento'
}

/**
 * Sube un documento a `{user}/{item}/{uuid}/{nombre}` (la carpeta del usuario es la que exige la
 * política del bucket) y devuelve la ruta. Con `XMLHttpRequest` y no con `supabase-js`, que no
 * dice cuánto lleva: así sale «Subiendo… 60 %» (F3). `signal` lo cancela (la ✕).
 */
export async function uploadItemFile(
  itemId: string,
  checked: CheckedFile,
  { onProgress, signal }: { onProgress: (fraction: number) => void; signal: AbortSignal },
): Promise<string> {
  const { data: auth } = await supabase.auth.getSession()
  const session = auth.session
  if (!session) throw new Error('Sin sesión')
  const path = `${session.user.id}/${itemId}/${crypto.randomUUID()}/${storageName(checked.name)}`
  const url = `${SUPABASE_URL}/storage/v1/object/${FILE_BUCKET}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', url)
    request.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
    request.setRequestHeader('apikey', SUPABASE_ANON_KEY)
    request.setRequestHeader('Content-Type', checked.mime)
    request.setRequestHeader('x-upsert', 'false')
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve()
      else reject(new Error(`Storage respondió ${String(request.status)}`))
    }
    request.onerror = () => {
      reject(new Error('Sin conexión'))
    }
    request.onabort = () => {
      reject(new DOMException('Cancelado', 'AbortError'))
    }
    signal.addEventListener('abort', () => {
      request.abort()
    })
    request.send(checked.file)
  })
  return path
}

/** Los enlaces firmados para abrir unos documentos, por su ruta. */
export async function signedFileUrls(paths: readonly string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await supabase.storage
    .from(FILE_BUCKET)
    .createSignedUrls([...paths], FILE_URL_SECONDS)
  if (error) throw error
  return Object.fromEntries(
    data.flatMap((entry) => (entry.path && entry.signedUrl ? [[entry.path, entry.signedUrl]] : [])),
  )
}
