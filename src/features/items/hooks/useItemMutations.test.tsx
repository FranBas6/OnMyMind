import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { List } from '@/features/lists'
import { queryKeys } from '@/lib/queryKeys'

import * as api from '../api'
import type { Item } from '../types'
import { nextItemPosition, useCreateItem, useSetItemStatus } from './useItemMutations'

vi.mock('../api')
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const casa: List = {
  id: 'casa',
  name: 'Casa',
  color: 'coral',
  icon: null,
  kind: 'tasks',
  position: 2000,
  counters: { pending: 1, done: 0, pendingPriceCents: 0 },
  archivedAt: null,
}

const grifo: Item = {
  id: 'grifo',
  listId: 'casa',
  title: 'Arreglar el grifo',
  notes: null,
  status: 'pending',
  priority: null,
  dueAt: null,
  allDay: false,
  recurrence: null,
  position: 1000,
  completedAt: null,
  createdAt: new Date('2026-09-20T10:00:00'),
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(queryKeys.lists.all, [casa])
  queryClient.setQueryData(queryKeys.items.byList('casa'), [grifo])
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const items = () => queryClient.getQueryData<Item[]>(queryKeys.items.byList('casa'))
  const counters = () => queryClient.getQueryData<List[]>(queryKeys.lists.all)?.[0]?.counters
  return { wrapper, items, counters }
}

describe('mutaciones de ítems', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(api.fetchItems).mockResolvedValue([grifo])
  })

  it('la posición nueva va al final', () => {
    expect(nextItemPosition([grifo, { ...grifo, position: 3000 }])).toBe(4000)
    expect(nextItemPosition(undefined)).toBe(1000)
  })

  it('completar cambia estado y contadores antes de que conteste el servidor', async () => {
    vi.mocked(api.updateItemStatus).mockReturnValue(new Promise(() => undefined))
    const { wrapper, items, counters } = setup()
    const { result } = renderHook(() => useSetItemStatus('casa'), { wrapper })

    act(() => {
      result.current.mutate({ item: grifo, status: 'done' })
    })

    await waitFor(() => {
      expect(items()?.[0]?.status).toBe('done')
    })
    expect(items()?.[0]?.completedAt).toBeInstanceOf(Date)
    expect(counters()).toMatchObject({ pending: 0, done: 1 })
  })

  it('si añadir falla, el ítem desaparece y los contadores vuelven', async () => {
    vi.mocked(api.createItem).mockRejectedValue(new Error('new row violates row-level security'))
    const { wrapper, items, counters } = setup()
    const { result } = renderHook(() => useCreateItem('casa'), { wrapper })

    act(() => {
      result.current.mutate({
        id: 'nuevo',
        listId: 'casa',
        title: 'Pagar la comunidad',
        status: 'pending',
        position: 2000,
      })
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(items()?.map((entry) => entry.id)).toEqual(['grifo'])
    expect(counters()).toMatchObject({ pending: 1, done: 0 })
  })
})
