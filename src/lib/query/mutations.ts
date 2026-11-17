import {
  useMutation,
  type MutationKey,
  type MutationObserverOptions,
  type OmitKeyof,
  type QueryClient,
} from '@tanstack/react-query'

import { isNetworkError } from './errors'

/**
 * Sin red, la mutación espera (`networkMode: 'online'`) en vez de fallar: el cambio optimista ya
 * se ve y se envía solo al volver la conexión. Si la red cae a mitad, se reintenta hasta tres
 * veces; cualquier otro error (RLS, validación) no se reintenta porque no se arreglaría.
 */
export const WAITS_FOR_NETWORK = {
  networkMode: 'online',
  retry: (failureCount: number, error: Error) => isNetworkError(error) && failureCount < 3,
} as const

type DurableOptions<TVariables, TData, TContext> = OmitKeyof<
  MutationObserverOptions<TData, Error, TVariables, TContext>,
  'mutationKey'
>

/**
 * Una mutación que sobrevive a cerrar la app (2.10, ADR-005). Si espera la red cuando se cierra,
 * se guarda en IndexedDB con la caché, pero de ella solo se guardan los datos: la clave, las
 * variables y el contexto de `onMutate`. Las funciones no caben en IndexedDB. Al volver a abrir,
 * TanStack Query la reconstruye buscando por su clave lo registrado con `setMutationDefaults`, y
 * de ahí saca qué enviar (`mutationFn`) y qué hacer al terminar (`onError`, `onSettled`).
 */
export interface DurableMutation<TVariables, TData, TContext> {
  readonly mutationKey: MutationKey
  /** Lo que se registra: recibe el QueryClient porque los callbacks tocan su caché. */
  readonly options: (queryClient: QueryClient) => DurableOptions<TVariables, TData, TContext>
  /** Registra la mutación en el QueryClient, antes de restaurar la caché guardada. */
  readonly register: (queryClient: QueryClient) => void
}

export function durableMutation<TVariables, TData = void, TContext = unknown>(
  mutationKey: MutationKey,
  options: (queryClient: QueryClient) => DurableOptions<TVariables, TData, TContext>,
): DurableMutation<TVariables, TData, TContext> {
  return {
    mutationKey,
    options,
    register: (queryClient) => {
      queryClient.setMutationDefaults(mutationKey, options(queryClient))
    },
  }
}

/**
 * El hook de una mutación registrada. Solo pasa la clave: todo lo demás sale de lo registrado, así
 * que una mutación hecha ahora y una restaurada al abrir la app ejecutan exactamente lo mismo.
 */
export function useDurableMutation<TVariables, TData, TContext>(
  mutation: DurableMutation<TVariables, TData, TContext>,
) {
  return useMutation<TData, Error, TVariables, TContext>({ mutationKey: mutation.mutationKey })
}

// ─── La fila de los ítems ────────────────────────────────────────────────────────────────────
// Aquí y no en `features/items` (6.10): la usan también los avisos, y `items` y `reminders` se
// importan el uno al otro. Desde aquí no hay ciclo.

/**
 * Todas las mutaciones de ítems empiezan su clave por `items` y comparten `scope`. El `scope` las
 * pone en fila: se envían de una en una y en orden, así que completar un ítem recién creado sin
 * red nunca llega a Supabase antes que su alta, ni un «Deshacer» antes que el borrado. Con el
 * prefijo se sabe cuántas quedan en vuelo; el resto de la clave dice cuál es, para encontrar su
 * función al restaurarla (2.10).
 */
export const ITEM_MUTATION_KEY = ['items'] as const

const ITEM_MUTATION_SCOPE = { id: 'items' }

/**
 * Sin red esperan en vez de fallar (`WAITS_FOR_NETWORK`), en fila. Los avisos (2.6) van en la
 * misma fila: el de un ítem creado sin red sale detrás de su alta.
 */
export const OFFLINE_TOLERANT = { ...WAITS_FOR_NETWORK, scope: ITEM_MUTATION_SCOPE } as const

/** La clave de una mutación de ítems: `items` y cuál es. */
export const itemMutationKey = (name: string) => [...ITEM_MUTATION_KEY, name] as const
