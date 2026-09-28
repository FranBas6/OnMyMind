import type { List } from '@/features/lists'

/** Chips de «Guardar en» que caben sin el «···» (diseño 07: el origen o «En mente» y los más usados). */
export const CHIP_COUNT = 4

/** Uso de una lista: todo lo que tiene, pendiente o hecho. */
const usage = (list: List) => list.counters.pending + list.counters.done

interface ChipOptions {
  chosenId: string | undefined
  originId: string | undefined
  /** La lista por defecto de Perfil (1.13), si no es «En mente». */
  defaultId?: string | null | undefined
}

/**
 * Chips de «Guardar en» (diseño 07). Primero la lista de origen si la captura se abrió dentro
 * de una (decisión de Fran en 1.10: solo desde dentro, no la última vista), después la lista por
 * defecto de Perfil, «En mente» y, a continuación, las más usadas por número de ítems. Una lista
 * elegida con «···» que no está entre ellas pasa a ser la primera; tocar un chip que ya está no
 * reordena nada.
 */
export function destinationChips(
  lists: readonly List[],
  { chosenId, originId, defaultId }: ChipOptions,
): List[] {
  const inbox = lists.find((list) => list.kind === 'inbox')
  const origin = lists.find((list) => list.id === originId)
  const preferred = lists.find((list) => list.id === defaultId && list.id !== originId)
  const others = lists
    .filter((list) => list.kind !== 'inbox' && list.id !== originId && list.id !== preferred?.id)
    .sort((a, b) => usage(b) - usage(a) || a.position - b.position)

  const base = [origin, preferred, inbox, ...others]
    .filter((list): list is List => list !== undefined)
    .slice(0, CHIP_COUNT)
  const chosen = lists.find((list) => list.id === chosenId)
  if (!chosen || base.some((list) => list.id === chosen.id)) return base
  return [chosen, ...base].slice(0, CHIP_COUNT)
}

/**
 * Destino al abrir: la lista de origen; si no hay, la lista por defecto de Perfil (1.13) y, si
 * no hay o ya no está (archivada, borrada), «En mente».
 */
export function defaultDestination(
  lists: readonly List[],
  originId: string | undefined,
  defaultId?: string | null,
): List | undefined {
  return (
    lists.find((list) => list.id === originId) ??
    lists.find((list) => list.id === defaultId) ??
    lists.find((list) => list.kind === 'inbox')
  )
}
