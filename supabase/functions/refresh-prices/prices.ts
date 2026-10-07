// Lo puro de refresh-prices (sesión 3.8): qué se lee de la base, qué precio da una página y qué se
// envía cuando una compra baja. Sin Deno ni red, para probarlo con Vitest desde la app, como
// `send-reminders/messages.ts`.

import { parseMetadata } from '../_shared/metadata.ts'
import type { FetchedPage } from '../_shared/page.ts'
import type { PushMessage } from '../_shared/push.ts'

/** Lo que toca mirar, como lo da `price_checks_due`: una compra con una tienda, o una de sus tiendas. */
export interface DueCheck {
  target: 'item' | 'link'
  id: string
  url: string
}

/** Una bajada, como la devuelve `record_price_check`. */
export interface PriceDrop {
  itemId: string
  listId: string
  title: string
  store: string | null
  beforeCents: number
  afterCents: number
  currency: string
  /** Cuándo se miró el precio de antes, para «20 € menos que ayer». */
  beforeCheckedAt: Date | null
  /** Quién lo pidió y lo tiene encendido. */
  recipients: string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function toDueCheck(row: unknown): DueCheck | null {
  if (!isRecord(row)) return null
  const { target, id, url } = row
  if (
    (target !== 'item' && target !== 'link') ||
    typeof id !== 'string' ||
    typeof url !== 'string'
  ) {
    return null
  }
  return { target, id, url }
}

export function toPriceDrop(row: unknown): PriceDrop | null {
  if (!isRecord(row)) return null
  const {
    item_id,
    list_id,
    title,
    store,
    before_cents,
    after_cents,
    currency,
    before_checked_at,
    recipients,
  } = row
  if (
    typeof item_id !== 'string' ||
    typeof list_id !== 'string' ||
    typeof title !== 'string' ||
    typeof before_cents !== 'number' ||
    typeof after_cents !== 'number' ||
    typeof currency !== 'string' ||
    !Array.isArray(recipients)
  ) {
    return null
  }
  return {
    itemId: item_id,
    listId: list_id,
    title,
    store: typeof store === 'string' && store !== '' ? store : null,
    beforeCents: before_cents,
    afterCents: after_cents,
    currency,
    beforeCheckedAt: typeof before_checked_at === 'string' ? new Date(before_checked_at) : null,
    recipients: recipients.filter((id): id is string => typeof id === 'string'),
  }
}

/**
 * El precio de una página, o `null` si no lo da. Sin página (la web no deja pasar), una imagen en
 * vez de una página o una página sin precio cuentan igual: un fallo de esa mañana.
 */
export function pagePrice(page: FetchedPage | null): { cents: number; currency: string } | null {
  if (!page || page.image !== undefined) return null
  return parseMetadata(page.html, page.url).price
}

/** Céntimos → «79 €», «9,99 €», «49 US$»: igual que `formatCents` de la app (lo comprueba un test). */
export function formatCents(cents: number, currency = 'EUR'): string {
  const hasDecimals = cents % 100 !== 0
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(cents / 100)
}

/** La zona en la que se dice «ayer»: la de la hora del cron (9:00 en Madrid). */
const ZONE = 'Europe/Madrid'

/** El día de una fecha en Madrid, como «2026-10-07». */
function dayIn(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(date)
}

/** «que ayer» si el precio de antes se miró ayer (lo normal, cada mañana); si no, «que antes». */
export function sinceWhen(before: Date | null, now: Date): string {
  if (!before) return 'que antes'
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  return dayIn(before) === dayIn(yesterday) ? 'que ayer' : 'que antes'
}

/** Abre la hoja «Bajaron esta mañana» (diseño 22, N3): `/?bajadas=hoy`. */
export const DROPS_URL = '/?bajadas=hoy'

/**
 * El aviso de una bajada (diseño 22, N1): la compra de título y «Bajó a 79 € en Keychron, 20 €
 * menos que ayer.». Abre su ficha. Una por compra: si vuelve a bajar, sustituye a la anterior
 * (`tag`).
 */
export function dropMessage(drop: PriceDrop, now: Date = new Date()): PushMessage {
  const price = formatCents(drop.afterCents, drop.currency)
  const store = drop.store ? ` en ${drop.store}` : ''
  const less = formatCents(drop.beforeCents - drop.afterCents, drop.currency)
  return {
    title: drop.title,
    body: `Bajó a ${price}${store}, ${less} menos ${sinceWhen(drop.beforeCheckedAt, now)}.`,
    url: `/lists/${drop.listId}?item=${drop.itemId}`,
    tag: `price:${drop.itemId}`,
  }
}

/**
 * Varias la misma mañana van juntas (N2): «3 compras bajaron de precio» con «Auriculares a 79 €,
 * Monitor LG a 229 € y 1 más.». Abre la hoja con todas.
 */
export function dropsMessage(drops: readonly PriceDrop[]): PushMessage {
  const named = drops
    .slice(0, 2)
    .map((drop) => `${drop.title} a ${formatCents(drop.afterCents, drop.currency)}`)
  const rest = drops.length - named.length
  const body =
    rest > 0
      ? `${named.join(', ')} y ${String(rest)} más.`
      : `${named.slice(0, -1).join(', ')} y ${named.at(-1) ?? ''}.`
  return {
    title: `${String(drops.length)} compras bajaron de precio`,
    body,
    url: DROPS_URL,
    tag: 'price-drops',
  }
}

/**
 * Qué se envía a quién. Si una compra con varias tiendas bajó dos veces la misma mañana (dos tiendas
 * mejoraron), cuenta una vez: la última, la más baja, y desde el precio de antes de la primera.
 * Cada persona recibe un aviso: el de su compra o, si son varias, uno con todas.
 */
export function planDrops(
  drops: readonly PriceDrop[],
  now: Date = new Date(),
): { userId: string; message: PushMessage }[] {
  const byItem = new Map<string, PriceDrop>()
  for (const drop of drops) {
    const earlier = byItem.get(drop.itemId)
    byItem.set(
      drop.itemId,
      earlier
        ? { ...drop, beforeCents: earlier.beforeCents, beforeCheckedAt: earlier.beforeCheckedAt }
        : drop,
    )
  }
  const byUser = new Map<string, PriceDrop[]>()
  for (const drop of byItem.values()) {
    for (const userId of drop.recipients) byUser.set(userId, [...(byUser.get(userId) ?? []), drop])
  }
  return [...byUser].map(([userId, mine]) => ({
    userId,
    message: mine.length === 1 && mine[0] ? dropMessage(mine[0], now) : dropsMessage(mine),
  }))
}
