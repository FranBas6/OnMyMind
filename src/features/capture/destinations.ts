import type { List } from '@/features/lists'

/** Chips de «Guardar en» que caben sin el «···» (diseño 07: el origen o «En mente» y los más usados). */
export const CHIP_COUNT = 4

/** Uso de una lista: todo lo que tiene, pendiente o hecho. */
const usage = (list: List) => list.counters.pending + list.counters.done

/**
 * Chips de «Guardar en» (diseño 07). Primero la lista de origen si la captura se abrió dentro
 * de una (decisión de Fran en 1.10: solo desde dentro, no la última vista), después «En mente»
 * y, a continuación, las más usadas por número de ítems. Una lista elegida con «···» que no está
 * entre ellas pasa a ser la primera; tocar un chip que ya está no reordena nada.
 */
export function destinationChips(
  lists: readonly List[],
  { chosenId, originId }: { chosenId: string | undefined; originId: string | undefined },
): List[] {
  const inbox = lists.find((list) => list.kind === 'inbox')
  const origin = lists.find((list) => list.id === originId)
  const others = lists
    .filter((list) => list.kind !== 'inbox' && list.id !== originId)
    .sort((a, b) => usage(b) - usage(a) || a.position - b.position)

  const base = [origin, inbox, ...others]
    .filter((list): list is List => list !== undefined)
    .slice(0, CHIP_COUNT)
  const chosen = lists.find((list) => list.id === chosenId)
  if (!chosen || base.some((list) => list.id === chosen.id)) return base
  return [chosen, ...base].slice(0, CHIP_COUNT)
}

/** Destino al abrir: la lista de origen o, si no hay, «En mente». */
export function defaultDestination(
  lists: readonly List[],
  originId: string | undefined,
): List | undefined {
  return lists.find((list) => list.id === originId) ?? lists.find((list) => list.kind === 'inbox')
}
