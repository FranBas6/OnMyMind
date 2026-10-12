import { MutationObserver, onlineManager, type QueryClient } from '@tanstack/react-query'
import { waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
import type { NewItem } from '@/features/items/api'
import { itemMutationKey } from '@/features/items/hooks/useItemMutations'
import type { Item } from '@/features/items'
import type { List } from '@/features/lists'
import { queryKeys } from '@/lib/queryKeys'

import { restoreQueryCache } from './persister'
import { createQueryClient } from './query-client'

vi.mock('@/features/items/api')

// IndexedDB de mentira: guarda copias con *structured clone*, como la de verdad. Lo que no se
// pueda clonar (una función) fallaría aquí igual que en el navegador.
const disk = vi.hoisted(() => new Map<string, unknown>())
vi.mock('idb-keyval', () => ({
  get: (key: string) => Promise.resolve(structuredClone(disk.get(key))),
  set: (key: string, value: unknown) => {
    disk.set(key, structuredClone(value))
    return Promise.resolve()
  },
  del: (key: string) => {
    disk.delete(key)
    return Promise.resolve()
  },
}))

const casa: List = {
  id: 'casa',
  name: 'Casa',
  color: 'coral',
  icon: null,
  kind: 'shopping',
  view: 'list',
  position: 2000,
  counters: {
    pending: 1,
    done: 0,
    pendingPriceCents: 0,
    notes: 0,
    kinds: { note: 0, task: 0, shopping: 0, event: 0 },
  },
  archivedAt: null,
  isOwner: true,
}
const agenda: List = { ...casa, id: 'agenda', name: 'Agenda', kind: 'tasks', position: 3000 }

const pan: Item = {
  id: 'pan',
  listId: 'casa',
  kind: 'shopping',
  parentId: null,
  chooseOne: false,
  chosenId: null,
  sealed: null,
  title: 'Pan',
  notes: null,
  status: 'pending',
  priority: null,
  dueAt: null,
  allDay: false,
  recurrence: null,
  position: 1000,
  completedAt: null,
  createdAt: new Date('2026-10-01T10:00:00'),
  leftInboxId: null,
  leftInboxAt: null,
  url: null,
  urlTitle: null,
  imageUrl: null,
  imagePath: null,
  urlSite: null,
  priceCents: 120,
  currency: 'EUR',
  priceSource: 'manual',
  previousPriceCents: null,
  priceCheckedAt: null,
  links: [],
  images: [],
  priceLinkId: null,
  priceStore: null,
  priceTracking: null,
  createdBy: null,
  completedBy: null,
}

const leche: NewItem = {
  id: 'leche',
  listId: 'casa',
  kind: 'shopping',
  title: 'Leche',
  status: 'pending',
}

/** Lanza una mutación como lo haría su hook: solo con la clave. */
function mutate(queryClient: QueryClient, name: string, variables: unknown) {
  const observer = new MutationObserver<unknown, Error, unknown>(queryClient, {
    mutationKey: itemMutationKey(name),
  })
  observer.mutate(variables).catch(() => undefined)
}

/** Abrir la app: un QueryClient nuevo, con lo guardado en «IndexedDB». */
async function openApp() {
  const queryClient = createQueryClient()
  queryClient.mount()
  await restoreQueryCache(queryClient)
  return queryClient
}

/** Cerrar la app: pasa al selector de apps (lo pendiente se guarda ya) y nada más. */
function closeApp(queryClient: QueryClient) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
  document.dispatchEvent(new Event('visibilitychange'))
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  queryClient.unmount()
}

const cached = (queryClient: QueryClient) =>
  queryClient.getQueryData<Item[]>(queryKeys.items.byList('casa'))

describe('la cola sin conexión sobrevive a cerrar la app (2.10)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    disk.clear()
    vi.mocked(itemsApi.createItem).mockResolvedValue()
    vi.mocked(itemsApi.updateItemStatus).mockResolvedValue()
    vi.mocked(itemsApi.updateItem).mockResolvedValue()
    vi.mocked(itemsApi.moveItem).mockResolvedValue()
    vi.mocked(itemsApi.fetchItems).mockResolvedValue([])
  })
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('sin red: capturar «Leche», cerrar y abrir con red la envía, y se ve mientras', async () => {
    onlineManager.setOnline(false)
    const before = await openApp()
    before.setQueryData(queryKeys.lists.all, [casa])
    before.setQueryData(queryKeys.items.byList('casa'), [pan])

    mutate(before, 'create', leche)
    await waitFor(() => {
      expect(cached(before)?.map((item) => item.title)).toEqual(['Pan', 'Leche'])
    })
    closeApp(before)
    expect(itemsApi.createItem).not.toHaveBeenCalled()

    onlineManager.setOnline(true)
    const after = await openApp()
    // Lo optimista vuelve con la caché: «Leche» se ve antes de que conteste el servidor.
    expect(cached(after)?.map((item) => item.title)).toEqual(['Pan', 'Leche'])
    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(leche)
    })
  })

  it('completar, cambiar el precio y mover sin red llega todo, en el orden en que se hizo', async () => {
    onlineManager.setOnline(false)
    const before = await openApp()
    before.setQueryData(queryKeys.lists.all, [casa, agenda])
    before.setQueryData(queryKeys.items.byList('casa'), [pan])

    mutate(before, 'create', leche)
    mutate(before, 'status', { item: itemFromLeche(), status: 'bought' })
    mutate(before, 'update', { item: pan, patch: { priceCents: 135 } })
    mutate(before, 'move', { item: pan, from: casa, to: agenda })
    await waitFor(() => {
      expect(cached(before)?.map((item) => item.title)).toEqual(['Leche'])
    })
    closeApp(before)

    onlineManager.setOnline(true)
    await openApp()
    await waitFor(() => {
      expect(itemsApi.moveItem).toHaveBeenCalled()
    })
    const order = [
      itemsApi.createItem,
      itemsApi.updateItemStatus,
      itemsApi.updateItem,
      itemsApi.moveItem,
    ].map((fn) => vi.mocked(fn).mock.invocationCallOrder[0] ?? 0)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(itemsApi.updateItemStatus).toHaveBeenCalledWith('leche', 'bought')
    expect(itemsApi.updateItem).toHaveBeenCalledWith('pan', { priceCents: 135 })
  })

  it('si se abre aún sin red, espera, y sale sola al volver la conexión', async () => {
    onlineManager.setOnline(false)
    const before = await openApp()
    before.setQueryData(queryKeys.items.byList('casa'), [pan])
    mutate(before, 'create', leche)
    await waitFor(() => {
      expect(cached(before)).toHaveLength(2)
    })
    closeApp(before)

    const after = await openApp()
    expect(after.isMutating()).toBe(1)
    expect(itemsApi.createItem).not.toHaveBeenCalled()

    onlineManager.setOnline(true)
    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(leche)
    })
  })

  it('no se guarda lo que no se sabría repetir: una mutación sin función registrada', async () => {
    onlineManager.setOnline(false)
    const before = await openApp()
    const observer = new MutationObserver(before, {
      networkMode: 'online',
      mutationFn: () => Promise.resolve(),
    })
    observer.mutate().catch(() => undefined)
    mutate(before, 'create', leche)
    await waitFor(() => {
      expect(before.isMutating()).toBe(2)
    })
    closeApp(before)

    const after = await openApp()
    expect(after.getMutationCache().getAll()).toHaveLength(1)
    expect(after.getMutationCache().getAll()[0]?.options.mutationKey).toEqual(
      itemMutationKey('create'),
    )
  })

  it('con cambios por enviar, lo que ya está en pantalla no se vuelve a pedir al montarse', async () => {
    onlineManager.setOnline(false)
    const queryClient = await openApp()
    const { refetchOnMount } = queryClient.getDefaultOptions().queries ?? {}
    if (typeof refetchOnMount !== 'function') throw new Error('refetchOnMount no es una función')
    const query = queryClient
      .getQueryCache()
      .build(queryClient, { queryKey: ['x'] as readonly unknown[] })

    expect(refetchOnMount(query)).toBe(true)
    mutate(queryClient, 'create', leche)
    expect(refetchOnMount(query)).toBe(false)
  })
})

/** «Leche» tal como queda en la caché tras capturarla, para completarla. */
function itemFromLeche(): Item {
  return { ...pan, id: 'leche', title: 'Leche', priceCents: null, priceSource: null }
}
