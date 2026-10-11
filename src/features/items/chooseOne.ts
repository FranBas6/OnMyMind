import { formatCents } from '@/lib/money'

import { isActiveSublistStatus, isOutOfMind } from './status'
import type { Item } from './types'

/**
 * Elegir una (5.1, diseño 24): una sublista «para elegir una» tiene opciones entre las que se
 * elige una sola («Volantes», con el G29 y el G923). Mientras está activa, sus opciones pendientes
 * cuentan como una sola cosa, y en el total suma la elegida o, sin elegida, la compra pendiente más
 * barata, con las mismas reglas que `list_counters`. Elegir solo marca la preferida (Fran,
 * 2026-10-11): comprarla, hacerla o descartar las demás va como siempre, con su estado.
 */

/** Si la sublista es «para elegir una» y está activa: pendiente o en curso. */
export function isChoosing(sublist: Pick<Item, 'kind' | 'chooseOne' | 'status'>): boolean {
  return sublist.kind === 'sublist' && sublist.chooseOne && isActiveSublistStatus(sublist.status)
}

/** La elegida, si sigue dentro. */
export function chosenOption(
  sublist: Pick<Item, 'chosenId'>,
  children: readonly Item[],
): Item | null {
  if (sublist.chosenId === null) return null
  return children.find((child) => child.id === sublist.chosenId) ?? null
}

/** Las opciones que siguen en juego: lo de dentro que no está fuera de la cabeza. */
export function openOptions(children: readonly Item[], now: Date = new Date()): Item[] {
  return children.filter((child) => !isOutOfMind(child, now))
}

/**
 * La opción más barata: la compra pendiente con precio que menos cuesta, primero en euros (lo que
 * suma el total), como `cheapestLink` con las tiendas. Lo que no tiene precio no compite.
 */
export function cheapestOption(children: readonly Item[], now: Date = new Date()): Item | null {
  const priced = openOptions(children, now).filter(
    (child) => child.kind === 'shopping' && child.priceCents !== null,
  )
  priced.sort(
    (a, b) =>
      Number(a.currency !== 'EUR') - Number(b.currency !== 'EUR') ||
      (a.priceCents ?? 0) - (b.priceCents ?? 0) ||
      a.position - b.position,
  )
  return priced[0] ?? null
}

/**
 * La opción que cuenta en el total: la elegida mientras siga pendiente (aunque no tenga precio, y
 * entonces no suma nada) o, si no, la más barata.
 */
export function countedOption(
  sublist: Pick<Item, 'chosenId'>,
  children: readonly Item[],
  now: Date = new Date(),
): Item | null {
  const chosen = chosenOption(sublist, children)
  if (chosen && !isOutOfMind(chosen, now)) return chosen
  return cheapestOption(children, now)
}

/**
 * Lo que dice cada opción a la derecha, bajo su precio (diseño 24, A2 y A8): «Elegida» en la
 * elegida; «Más barata» en la ganadora y cuánto más cuestan las demás («+50,99 €»), como las
 * tiendas de una compra (diseño 19); y «Sin precio» en una compra que no lo tiene.
 */
export type OptionMark =
  { kind: 'chosen' } | { kind: 'cheapest' } | { kind: 'extra'; text: string } | { kind: 'unpriced' }

export function optionMarks(
  sublist: Item,
  children: readonly Item[],
  now: Date = new Date(),
): Map<string, OptionMark> {
  const marks = new Map<string, OptionMark>()
  const chosen = chosenOption(sublist, children)
  if (chosen) marks.set(chosen.id, { kind: 'chosen' })
  if (!isChoosing(sublist)) return marks

  const open = openOptions(children, now)
  const best = cheapestOption(children, now)
  const priced = open.filter((child) => child.kind === 'shopping' && child.priceCents !== null)
  for (const child of open) {
    if (child.kind !== 'shopping' || marks.has(child.id)) continue
    if (child.priceCents === null) {
      marks.set(child.id, { kind: 'unpriced' })
      continue
    }
    // Con una sola con precio no hay con qué compararla (A8b).
    if (!best || priced.length < 2) continue
    if (child.id === best.id) {
      marks.set(child.id, { kind: 'cheapest' })
      continue
    }
    if (child.currency !== best.currency || best.priceCents === null) continue
    const extra = child.priceCents - best.priceCents
    marks.set(
      child.id,
      extra > 0
        ? { kind: 'extra', text: `+${formatCents(extra, child.currency)}` }
        : { kind: 'cheapest' },
    )
  }
  return marks
}

const plural = (count: number, one: string, other: string) =>
  `${String(count)} ${count === 1 ? one : other}`

/**
 * Debajo del nombre de la sublista, en su fila y en su cabecera (A2, A7, A8b): «2 opciones · desde
 * 199 €», «1 opción · 199 €» o, sin precios, «2 opciones»; elegida una, «2 opciones · elegida
 * Logitech G923» mientras siga en juego. `null` si ya no queda ninguna.
 */
export function optionsMeta(
  sublist: Pick<Item, 'chosenId'>,
  children: readonly Item[],
  now: Date = new Date(),
): string | null {
  const open = openOptions(children, now)
  if (open.length === 0) return null
  const count = plural(open.length, 'opción', 'opciones')
  const chosen = chosenOption(sublist, children)
  if (chosen && !isOutOfMind(chosen, now)) return `${count} · elegida ${chosen.title}`
  const best = cheapestOption(children, now)
  if (best?.priceCents === undefined || best.priceCents === null) return count
  const price = formatCents(best.priceCents, best.currency)
  return open.length === 1 ? `${count} · ${price}` : `${count} · desde ${price}`
}

/**
 * «Elegida Logitech G923»: el aviso al elegir y, con la sublista hecha, su fila en «Fuera de la
 * cabeza» (A4c). Sin artículo: no se sabe el de cada cosa.
 */
export function chosenLabel(chosen: Pick<Item, 'title'>): string {
  return `Elegida ${chosen.title}`
}

/** La cabecera de la sublista hecha con su elegida (A4b): «Hecha · elegida Logitech G923». */
export function chosenSummary(chosen: Pick<Item, 'title'>): string {
  return `Hecha · elegida ${chosen.title}`
}

/**
 * Lo que cuenta la sublista al lado de su nombre o en su cabecera: mientras está activa, la opción
 * que cuenta («Cuenta en Compras · 199 €»); hecha y comprada la elegida, lo que se pagó («Pagaste ·
 * 199 €»). `null` si no hay precio.
 */
export function choicePrice(
  sublist: Item,
  children: readonly Item[],
  now: Date = new Date(),
): { paid: boolean; cents: number; currency: string } | null {
  if (sublist.status === 'done') {
    const chosen = chosenOption(sublist, children)
    if (chosen?.kind !== 'shopping' || chosen.status !== 'bought' || chosen.priceCents === null) {
      return null
    }
    return { paid: true, cents: chosen.priceCents, currency: chosen.currency }
  }
  if (!isChoosing(sublist)) return null
  const counted = countedOption(sublist, children, now)
  if (counted?.kind !== 'shopping' || counted.priceCents === null) return null
  return { paid: false, cents: counted.priceCents, currency: counted.currency }
}

/**
 * La línea bajo «Elegir esta» en el menú de una opción (A4): qué pasa al elegirla. Solo se marca;
 * comprarla o hacerla va como siempre.
 */
export function chooseNote(option: Pick<Item, 'kind'>): string {
  return option.kind === 'shopping'
    ? 'Pasa a contar en el total. Al comprarla, márcala como siempre.'
    : 'Queda como la preferida. Al hacerla, márcala como siempre.'
}
