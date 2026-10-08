import { format } from 'date-fns'

import { recurrenceLabel } from '@/features/items/recurrence'
import { PRIORITY_LABELS } from '@/features/items/fields'
import { KIND_LABELS } from '@/features/items/kind'
import { STATUS_LABELS } from '@/features/items/status'
import type { Item } from '@/features/items/types'
import type { List } from '@/features/lists/types'

/**
 * Exportar mis datos (sesión 2.8, diseño 18, P7 y P8): lo puro. El JSON es la copia de todo, con
 * las filas tal como están en la base (para guardarlo, llevártelo o importarlo en la fase 3); el
 * CSV es una lista como tabla para Numbers o Excel.
 */

/** La versión de la forma del JSON: si cambia, un importador sabrá qué tiene delante. */
/** 2 (4.5): con `item_images`, todas las fotos de cada cosa. */
export const EXPORT_FORMAT = 2

export interface ExportTables {
  profile: Record<string, unknown> | null
  lists: Record<string, unknown>[]
  items: Record<string, unknown>[]
  itemLinks: Record<string, unknown>[]
  /** Las fotos de cada cosa, en orden (4.5). */
  itemImages: Record<string, unknown>[]
  itemPrices: Record<string, unknown>[]
  reminders: Record<string, unknown>[]
  itemCompletions: Record<string, unknown>[]
}

/**
 * El documento del JSON. Las fotos van como enlaces (diseño 18, P7): cada ítem con foto lleva
 * `photo_url`, una URL firmada que dura una semana, además de su `image_path`; y todas sus fotos van
 * en `item_images`, cada una con su `photo_url` (4.5). Van también las
 * listas compartidas contigo (3.3, decisión de Fran: todo lo que ves), cada una con
 * `created_by_me` para distinguirlas de las tuyas.
 */
export function exportDocument(
  tables: ExportTables,
  photoUrls: ReadonlyMap<string, string>,
  now: Date = new Date(),
) {
  return {
    app: 'OnMyMind',
    format: EXPORT_FORMAT,
    exported_at: now.toISOString(),
    profile: tables.profile,
    lists: tables.lists.map((list) => ({
      ...list,
      created_by_me: list.owner_id === tables.profile?.id,
    })),
    items: tables.items.map((item) => {
      const path = typeof item.image_path === 'string' ? item.image_path : null
      const url = path ? photoUrls.get(path) : undefined
      return url ? { ...item, photo_url: url } : item
    }),
    item_links: tables.itemLinks,
    // Cada foto con su enlace firmado, como la de la cosa.
    item_images: tables.itemImages.map((image) => {
      const url = typeof image.path === 'string' ? photoUrls.get(image.path) : undefined
      return url ? { ...image, photo_url: url } : image
    }),
    item_prices: tables.itemPrices,
    reminders: tables.reminders,
    item_completions: tables.itemCompletions,
  }
}

/** «onmymind-2026-10-05.json». */
export function exportFileName(now: Date = new Date()): string {
  return `onmymind-${format(now, 'yyyy-MM-dd')}.json`
}

/** «onmymind-casa-2026-10-05.csv»: el nombre de la lista sin tildes ni símbolos. */
export function listFileName(list: Pick<List, 'name'>, now: Date = new Date()): string {
  const slug = list.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `onmymind-${slug || 'lista'}-${format(now, 'yyyy-MM-dd')}.csv`
}

const COLUMNS = [
  'Título',
  'Sublista',
  'Tipo',
  'Estado',
  'Prioridad',
  'Fecha',
  'Hora',
  'Repetición',
  'Notas',
  'Enlace',
  'Precio',
  'Moneda',
  'Tienda',
  'Creado',
  'Terminado',
] as const

/**
 * Una celda: con punto y coma (lo que espera Excel en español; Numbers lo detecta) y entre
 * comillas si hace falta. Lo que empieza por `=`, `+` o `@` lleva un apóstrofo delante, para que
 * la hoja no lo tome por una fórmula.
 */
export function csvCell(value: string): string {
  const safe = /^[=+@\t\r]/.test(value) ? `'${value}` : value
  return /[;"\r\n]|^\s|\s$/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** «12,50»: con coma decimal y sin separador de miles, que es lo que lee una hoja en español. */
function priceCell(cents: number | null): string {
  if (cents === null) return ''
  return (cents / 100).toFixed(2).replace('.', ',')
}

const dateCell = (date: Date | null) => (date ? format(date, 'dd/MM/yyyy') : '')
const dateTimeCell = (date: Date | null) => (date ? format(date, 'dd/MM/yyyy HH:mm') : '')

/**
 * El orden de la lista, con lo de cada sublista justo debajo de ella (diseño 18, P8: «Las
 * sublistas salen como filas con su nombre en la columna «Sublista»»).
 */
export function csvOrder(items: readonly Item[]): { item: Item; sublist: string | null }[] {
  const byPosition = (a: Item, b: Item) =>
    a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime()
  const top = items.filter(
    (item) => item.parentId === null || !items.some((p) => p.id === item.parentId),
  )
  const rows: { item: Item; sublist: string | null }[] = []
  for (const item of [...top].sort(byPosition)) {
    rows.push({ item, sublist: null })
    if (item.kind !== 'sublist') continue
    const inside = items.filter((child) => child.parentId === item.id).sort(byPosition)
    for (const child of inside) rows.push({ item: child, sublist: item.title })
  }
  return rows
}

/** La marca de UTF-8 al principio: sin ella, Excel lee mal las tildes. */
const BOM = String.fromCharCode(0xfeff)

/** Una lista como CSV, con BOM para que las tildes se lean bien al abrirlo. */
export function listCsv(items: readonly Item[]): string {
  const lines = [COLUMNS.join(';')]
  for (const { item, sublist } of csvOrder(items)) {
    const timed = item.dueAt !== null && !item.allDay
    const cells = [
      item.title,
      sublist ?? '',
      KIND_LABELS[item.kind],
      STATUS_LABELS[item.status],
      item.priority ? PRIORITY_LABELS[item.priority] : '',
      dateCell(item.dueAt),
      timed && item.dueAt ? format(item.dueAt, 'HH:mm') : '',
      recurrenceLabel(item.recurrence) ?? '',
      item.notes ?? '',
      item.url ?? '',
      priceCell(item.priceCents),
      item.priceCents === null ? '' : item.currency,
      item.priceStore ?? item.urlSite ?? '',
      dateTimeCell(item.createdAt),
      dateTimeCell(item.completedAt),
    ]
    lines.push(cells.map(csvCell).join(';'))
  }
  return `${BOM}${lines.join('\r\n')}\r\n`
}

/** Las listas que se pueden exportar en CSV: «En mente» primero, luego las tuyas y las archivadas. */
export function exportableLists(
  inbox: List | undefined,
  lists: readonly List[],
  archived: readonly List[],
): List[] {
  return [...(inbox ? [inbox] : []), ...lists, ...archived]
}
