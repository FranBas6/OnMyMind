import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { queryKeys } from '@/lib/queryKeys'

import * as api from '../api'
import type { List } from '../types'
import {
  nextListPosition,
  useArchiveList,
  useCreateList,
  useDeleteList,
  useUnarchiveList,
} from './useListMutations'

vi.mock('../api')
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

function list(id: string, position: number): List {
  return {
    id,
    name: id,
    color: 'coral',
    icon: null,
    kind: 'tasks',
    view: 'list',
    position,
    counters: {
      pending: 0,
      done: 0,
      pendingPriceCents: 0,
      notes: 0,
      kinds: { note: 0, task: 0, shopping: 0, event: 0 },
    },
    archivedAt: null,
    isOwner: true,
  }
}

const casa = list('casa', 2000)
const compras = list('compras', 3000)
const viejas = list('viejas', 4000)

/** Una respuesta del servidor que el test resuelve o rechaza cuando quiere. */
function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(queryKeys.lists.all, [casa, compras])
  queryClient.setQueryData(queryKeys.lists.archived, [viejas])
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const ids = (key: readonly unknown[]) =>
    queryClient.getQueryData<List[]>(key)?.map((item) => item.id)
  return { queryClient, wrapper, ids }
}

describe('mutaciones de listas', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('archivar mueve la lista a archivadas antes de que conteste el servidor', async () => {
    const server = deferred()
    vi.mocked(api.archiveList).mockReturnValue(server.promise)
    const { wrapper, ids } = setup()
    const { result } = renderHook(() => useArchiveList(), { wrapper })

    act(() => {
      result.current.mutate(casa)
    })

    await waitFor(() => {
      expect(ids(queryKeys.lists.all)).toEqual(['compras'])
    })
    expect(ids(queryKeys.lists.archived)).toEqual(['casa', 'viejas'])

    server.resolve()
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
  })

  it('si archivar falla, la caché vuelve a como estaba', async () => {
    vi.mocked(api.archiveList).mockRejectedValue(new Error('TypeError: Failed to fetch'))
    const { wrapper, ids } = setup()
    const { result } = renderHook(() => useArchiveList(), { wrapper })

    act(() => {
      result.current.mutate(casa)
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(ids(queryKeys.lists.all)).toEqual(['casa', 'compras'])
    expect(ids(queryKeys.lists.archived)).toEqual(['viejas'])
  })

  it('desarchivar la devuelve a Inicio en su posición', async () => {
    vi.mocked(api.unarchiveList).mockReturnValue(deferred().promise)
    const { wrapper, ids } = setup()
    const { result } = renderHook(() => useUnarchiveList(), { wrapper })

    act(() => {
      result.current.mutate(list('entre', 2500))
    })

    await waitFor(() => {
      expect(ids(queryKeys.lists.all)).toEqual(['casa', 'entre', 'compras'])
    })
  })

  it('borrar la quita al instante y la restaura si falla', async () => {
    const server = deferred()
    vi.mocked(api.deleteList).mockReturnValue(server.promise)
    const { wrapper, ids } = setup()
    const { result } = renderHook(() => useDeleteList(), { wrapper })

    act(() => {
      result.current.mutate(compras)
    })
    await waitFor(() => {
      expect(ids(queryKeys.lists.all)).toEqual(['casa'])
    })

    server.reject(new Error('boom'))
    await waitFor(() => {
      expect(ids(queryKeys.lists.all)).toEqual(['casa', 'compras'])
    })
  })

  it('crear espera al servidor y añade la lista creada al final', async () => {
    const created = list('nueva', 5000)
    vi.mocked(api.createList).mockResolvedValue(created)
    const { queryClient, wrapper, ids } = setup()
    expect(nextListPosition(queryClient)).toBe(5000)
    const { result } = renderHook(() => useCreateList(), { wrapper })

    act(() => {
      result.current.mutate({ name: 'Nueva', color: 'coral' })
    })

    await waitFor(() => {
      expect(ids(queryKeys.lists.all)).toEqual(['casa', 'compras', 'nueva'])
    })
    expect(api.createList).toHaveBeenCalledWith({ name: 'Nueva', color: 'coral' }, 5000)
  })
})
