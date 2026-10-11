import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
import type { Item } from '@/features/items'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')

const casa: List = {
  id: 'casa',
  name: 'Casa',
  color: 'coral',
  icon: null,
  kind: 'tasks',
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

const grifo: Item = {
  id: '00000000-0000-4000-8000-000000000001',
  listId: 'casa',
  kind: 'task',
  parentId: null,
  chooseOne: false,
  chosenId: null,
  title: 'Arreglar el grifo',
  notes: null,
  status: 'pending',
  priority: null,
  dueAt: null,
  allDay: false,
  recurrence: null,
  position: 1000,
  completedAt: null,
  createdAt: new Date(),
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
}

function renderCasa() {
  vi.mocked(listsApi.fetchLists).mockResolvedValue([casa])
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockReturnValue(new Promise(() => undefined))
  return renderRoute('/lists/casa', {
    session: fakeSession(),
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, [casa])
      queryClient.setQueryData(queryKeys.items.byList('casa'), [grifo])
    },
  })
}

/** La superficie que se desliza: la que tiene `touch-action: pan-y`. */
async function rowSurface() {
  const title = await screen.findByRole('button', { name: 'Arreglar el grifo' })
  const surface = title.closest('.touch-pan-y')
  if (!surface) throw new Error('Sin superficie deslizable')
  return surface
}

/** Un dedo que se apoya en `x0`, se mueve en horizontal hasta `x0 + dx` y se levanta. */
function swipe(element: Element, dx: number, { x0 = 100, dy = 0 } = {}) {
  const touch = { pointerId: 1, pointerType: 'touch', isPrimary: true }
  fireEvent.pointerDown(element, { ...touch, clientX: x0, clientY: 300 })
  const steps = 6
  for (let step = 1; step <= steps; step++) {
    fireEvent.pointerMove(element, {
      ...touch,
      clientX: x0 + (dx * step) / steps,
      clientY: 300 + (dy * step) / steps,
    })
  }
  fireEvent.pointerUp(element, { ...touch, clientX: x0 + dx, clientY: 300 + dy })
}

describe('deslizar una fila', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('a la derecha 40 px vuelve sin hacer nada', async () => {
    renderCasa()
    swipe(await rowSurface(), 40)
    expect(itemsApi.updateItemStatus).not.toHaveBeenCalled()
  })

  it('a la derecha 100 px la pone en curso; 170 px, hecha', async () => {
    // Que conteste: las mutaciones van en fila y la segunda espera a la primera.
    vi.mocked(itemsApi.updateItemStatus).mockResolvedValue()
    renderCasa()

    swipe(await rowSurface(), 100)
    await waitFor(() => {
      expect(itemsApi.updateItemStatus).toHaveBeenLastCalledWith(grifo.id, 'in_progress')
    })

    swipe(await rowSurface(), 170)
    await waitFor(() => {
      expect(itemsApi.updateItemStatus).toHaveBeenLastCalledWith(grifo.id, 'done')
    })
  })

  it('mientras se arrastra va pegada al dedo, sin transición; al soltar vuelve animada', async () => {
    renderCasa()
    const surface = await rowSurface()
    const touch = { pointerId: 1, pointerType: 'touch', isPrimary: true }
    fireEvent.pointerDown(surface, { ...touch, clientX: 100, clientY: 300 })
    fireEvent.pointerMove(surface, { ...touch, clientX: 120, clientY: 300 })
    fireEvent.pointerMove(surface, { ...touch, clientX: 150, clientY: 300 })
    // La superficie lleva `duration-200` (su animación de entrada): sin `transition-none`, el
    // transform se animaría 200 ms en cada movimiento y la fila iría detrás del dedo.
    expect(surface).toHaveStyle({ transform: 'translateX(50px)' })
    expect(surface).toHaveClass('transition-none')
    fireEvent.pointerUp(surface, { ...touch, clientX: 150, clientY: 300 })
    expect(surface).not.toHaveClass('transition-none')
    expect(surface.className).toMatch(/motion-safe:transition-(transform|\[transform)/)
  })

  it('un gesto vertical es scroll: la fila no se mueve', async () => {
    renderCasa()
    const surface = await rowSurface()
    swipe(surface, 12, { dy: 120 })
    expect(itemsApi.updateItemStatus).not.toHaveBeenCalled()
    expect(surface).not.toHaveStyle({ transform: 'translateX(12px)' })
  })

  it('desde el borde izquierdo no empieza (es el «atrás» de Safari)', async () => {
    renderCasa()
    swipe(await rowSurface(), 170, { x0: 10 })
    expect(itemsApi.updateItemStatus).not.toHaveBeenCalled()
  })

  it('a la izquierda deja ver «Mover» y «Borrar»; «Borrar» la quita con deshacer', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.deleteItem).mockReturnValue(new Promise(() => undefined))
    renderCasa()

    swipe(await rowSurface(), -120, { x0: 300 })
    expect(await screen.findByRole('button', { name: 'Mover' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Borrar' }))

    expect(itemsApi.deleteItem).toHaveBeenCalledWith(grifo.id)
    expect(await screen.findByRole('button', { name: 'Deshacer' })).toBeInTheDocument()
  })

  it('con ratón no se desliza (en escritorio está el menú ···)', async () => {
    renderCasa()
    const surface = await rowSurface()
    const mouse = { pointerId: 1, pointerType: 'mouse', isPrimary: true, clientY: 300 }
    fireEvent.pointerDown(surface, { ...mouse, clientX: 100 })
    fireEvent.pointerMove(surface, { ...mouse, clientX: 300 })
    fireEvent.pointerUp(surface, { ...mouse, clientX: 300 })
    expect(itemsApi.updateItemStatus).not.toHaveBeenCalled()
  })
})
