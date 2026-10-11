import { proposedKind, type Destination } from '@/features/items'

/** Chips de «Guardar en» que caben sin el «···» (diseño 07: el origen o «En mente» y los más usados). */
export const CHIP_COUNT = 4

/** Uso de una lista: todo lo que tiene, pendiente o hecho. */
const usage = ({ list }: Destination) =>
  list.counters.pending + list.counters.notes + list.counters.done

interface ChipOptions {
  chosenId: string | undefined
  /** Donde se abrió la captura: una lista o una sublista (2a.5). */
  originId: string | undefined
  /** La lista por defecto de Perfil (1.13); puede ser la propia «En mente». */
  defaultId?: string | null | undefined
  /** La lista de compras propuesta para un producto (2.3): sale la primera (diseño 16, K1). */
  proposedId?: string | undefined
}

/**
 * Chips de «Guardar en» (diseño 07). Primero el destino de origen si la captura se abrió dentro
 * de una lista o de una sublista (decisión de Fran en 1.10: solo desde dentro, no la última
 * vista), después la lista por defecto de Perfil, «En mente» y, a continuación, las listas más
 * usadas por número de ítems (las sublistas no compiten ahí: se eligen con «···»). Un destino
 * elegido con «···» que no está entre ellos pasa a ser el primero; tocar un chip que ya está no
 * reordena nada. La lista de compras propuesta para un producto va siempre la primera.
 */
export function destinationChips(
  destinations: readonly Destination[],
  { chosenId, originId, defaultId, proposedId }: ChipOptions,
): Destination[] {
  const proposed = destinations.find((entry) => entry.id === proposedId)
  if (proposed) {
    const rest = destinationChips(destinations, { chosenId: undefined, originId, defaultId })
    return unique([proposed, ...rest]).slice(0, CHIP_COUNT)
  }
  const inbox = destinations.find((entry) => entry.list.kind === 'inbox' && !entry.sublist)
  const origin = destinations.find((entry) => entry.id === originId)
  const preferred = destinations.find((entry) => entry.id === defaultId && entry.id !== originId)
  const others = destinations
    .filter(
      (entry) =>
        !entry.sublist &&
        entry.list.kind !== 'inbox' &&
        entry.id !== originId &&
        entry.id !== preferred?.id,
    )
    .sort((a, b) => usage(b) - usage(a) || a.list.position - b.list.position)

  // Un destino sale una sola vez aunque sea a la vez origen, el de por defecto y «En mente» (si
  // en Perfil la lista por defecto es «En mente», o la captura se abre desde dentro de ella).
  const base = unique([origin, preferred, inbox, ...others]).slice(0, CHIP_COUNT)
  const chosen = destinations.find((entry) => entry.id === chosenId)
  if (!chosen || base.some((entry) => entry.id === chosen.id)) return base
  return [chosen, ...base].slice(0, CHIP_COUNT)
}

/** Los destinos en su orden, sin huecos ni repetidos. */
function unique(destinations: readonly (Destination | undefined)[]): Destination[] {
  const seen = new Set<string>()
  return destinations.filter((entry): entry is Destination => {
    if (!entry || seen.has(entry.id)) return false
    seen.add(entry.id)
    return true
  })
}

/**
 * Destino al abrir: el de origen (una lista o una sublista); si no hay, la lista por defecto de
 * Perfil (1.13) y, si no hay o ya no está (archivada, borrada), «En mente».
 */
export function defaultDestination(
  destinations: readonly Destination[],
  originId: string | undefined,
  defaultId?: string | null,
): Destination | undefined {
  return (
    destinations.find((entry) => entry.id === originId) ??
    destinations.find((entry) => entry.id === defaultId) ??
    destinations.find((entry) => entry.list.kind === 'inbox')
  )
}

/**
 * Adonde se propone guardar un producto (2.3): las listas no tienen tipo (5.3), así que es la que
 * más compras tiene entre las que proponen compra, y a igualdad, la más usada. Sin ninguna, no se
 * propone nada.
 */
export function shoppingDestination(destinations: readonly Destination[]): Destination | undefined {
  return destinations
    .filter((entry) => !entry.sublist && proposedKind(entry.list) === 'shopping')
    .sort(
      (a, b) =>
        b.list.counters.kinds.shopping - a.list.counters.kinds.shopping ||
        usage(b) - usage(a) ||
        a.list.position - b.list.position,
    )[0]
}
