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
