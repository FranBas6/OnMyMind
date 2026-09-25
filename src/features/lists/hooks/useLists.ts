import { useQuery } from '@tanstack/react-query'

import { listsQueryOptions } from '../queries'
import type { List } from '../types'

export interface ListsByRole {
  /** «En mente»: siempre existe una por usuario (índice único en la base). */
  inbox: List | undefined
  /** El resto, en su orden. */
  lists: List[]
}

function splitInbox(all: List[]): ListsByRole {
  return {
    inbox: all.find((list) => list.kind === 'inbox'),
    lists: all.filter((list) => list.kind !== 'inbox'),
  }
}

/**
 * Listas del usuario separadas en «En mente» y el resto. `select` transforma los datos de la
 * caché para este componente sin tocarlos: todos los que usan `useLists` comparten una sola
 * petición, y el resultado de `select` solo se recalcula cuando cambian los datos.
 */
export function useLists() {
  return useQuery({ ...listsQueryOptions, select: splitInbox })
}
