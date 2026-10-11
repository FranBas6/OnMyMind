import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
import type { Item } from '@/features/items'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')

const session = fakeSession()

const inbox: List = {
  id: 'i',
  name: 'En mente',
  color: 'indigo',
  icon: null,
  kind: 'inbox',
  view: 'list',
  position: 1000,
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
const casa: List = { ...inbox, id: 'casa', name: 'Casa', color: 'coral', kind: 'tasks' }

function item(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    listId: 'casa',
    kind: 'task',
    parentId: null,
    chooseOne: false,
    chosenId: null,
    title: 'Reformar la cocina',
    notes: null,
    status: 'pending',
    priority: null,
    dueAt: null,
    allDay: false,
    recurrence: null,
    position: 1000,
    completedAt: null,
    createdAt: new Date(2026, 8, 2),
    leftInboxId: null,
    leftInboxAt: null,
    url: null,
    urlTitle: null,
    imageUrl: null,
    imagePath: null,
    urlSite: null,
    priceCents: null,
    currency: 'EUR',
    priceSource: null,
    previousPriceCents: null,
    priceCheckedAt: null,
    links: [],
    images: [],
    priceLinkId: null,
    priceStore: null,
    priceTracking: null,
    createdBy: null,
    completedBy: null,
    ...overrides,
  }
}

function renderList(path: string, listId: string, items: Item[]) {
  const lists = [inbox, casa]
  vi.mocked(listsApi.fetchLists).mockResolvedValue(lists)
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockReturnValue(new Promise(() => undefined))
  vi.mocked(itemsApi.fetchMovedFromInbox).mockResolvedValue([])
  return renderRoute(path, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, lists)
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.byList(listId), items)
    },
  })
}

const rows = () => within(screen.getByRole('list', { name: 'Ítems' })).getAllByRole('listitem')

describe('el principio de las notas bajo el título (Fran, 2026-10-11)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('en una lista: una línea con las notas, sin saltos; sin notas, nada', async () => {
    renderList('/lists/casa', 'casa', [
      item('a', {
        title: 'Reformar la cocina',
        notes: 'Medir el hueco del frigo\nantes de pedir presupuestos.',
      }),
      item('b', { title: 'Arreglar el grifo', position: 2000 }),
      item('c', {
        title: 'Reforma del baño',
        kind: 'sublist',
        notes: 'Presupuestos antes de diciembre',
        position: 3000,
      }),
    ])
    expect(await screen.findByText('Reformar la cocina')).toBeInTheDocument()
    const [cocina, grifo, bano] = rows()
    expect(cocina).toHaveTextContent(
      'Reformar la cocinaNotas: Medir el hueco del frigo antes de pedir presupuestos.',
    )
    expect(grifo).not.toHaveTextContent('Notas:')
    expect(bano).toHaveTextContent('Reforma del bañoNotas: Presupuestos antes de diciembre')
  })

  it('en «En mente» también', async () => {
    renderList('/lists/i', 'i', [
      item('n', {
        listId: 'i',
        kind: 'note',
        title: 'Idea para el finde',
        notes: 'Ir a la sierra',
      }),
    ])
    expect(await screen.findByText('Idea para el finde')).toBeInTheDocument()
    expect(screen.getByText('Ir a la sierra')).toBeInTheDocument()
  })
})
