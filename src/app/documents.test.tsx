import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
import type { Item } from '@/features/items'
import type { ItemFile } from '@/features/items/types'
import * as files from '@/features/items/files'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/items/files', async (importOriginal) => ({
  ...(await importOriginal<typeof files>()),
  uploadItemFile: vi.fn(),
  signedFileUrls: vi.fn(),
}))

const session = fakeSession()
const REVOLUT = '00000000-0000-4000-8000-000000000061'

const casa: List = {
  id: 'casa',
  name: 'Casa',
  color: 'coral',
  icon: null,
  kind: 'list',
  view: 'list',
  position: 2000,
  counters: {
    pending: 1,
    done: 0,
    pendingPriceCents: 0,
    notes: 0,
    kinds: { note: 0, task: 1, shopping: 0, event: 0 },
  },
  archivedAt: null,
  isOwner: true,
  hidden: false,
}

function revolut(overrides: Partial<Item> = {}): Item {
  return {
    id: REVOLUT,
    listId: 'casa',
    kind: 'task',
    parentId: null,
    chooseOne: false,
    chosenId: null,
    sealed: null,
    title: 'Revisar el plan de ahorro de Revolut',
    notes: null,
    status: 'pending',
    priority: null,
    dueAt: null,
    allDay: true,
    recurrence: null,
    position: 1000,
    completedAt: null,
    createdAt: new Date(2026, 8, 3),
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
    files: [],
    priceLinkId: null,
    priceStore: null,
    priceTracking: null,
    createdBy: null,
    completedBy: null,
    ...overrides,
  }
}

const doc = (n: number, name = `Documento ${String(n)}.pdf`): ItemFile => ({
  id: `d${String(n)}`,
  path: `u/${REVOLUT}/${String(n)}/${name}`,
  name,
  mime: 'application/pdf',
  sizeBytes: 1258291,
  position: n * 1000,
})

function renderDetail(item: Item) {
  vi.mocked(listsApi.fetchLists).mockResolvedValue([casa])
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockReturnValue(new Promise(() => undefined))
  vi.mocked(itemsApi.insertFiles).mockResolvedValue()
  vi.mocked(itemsApi.deleteFile).mockResolvedValue()
  vi.mocked(files.signedFileUrls).mockImplementation((paths) =>
    Promise.resolve(Object.fromEntries(paths.map((path) => [path, `https://firmado/${path}`]))),
  )
  return renderRoute(`/lists/casa?item=${item.id}`, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, [casa])
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.byList('casa'), [item])
    },
  })
}

const sheet = () => screen.findByRole('dialog', { name: /Detalle de/ })

/** Un archivo con el tamaño que se diga, sin crear los bytes. */
function fileOf(name: string, type: string, size = 1258291): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('documentos en la ficha (6.1, diseño 29)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('sin nada, «+ Foto», «+ Enlace» y «+ Documento» en una fila (F1)', async () => {
    renderDetail(revolut())
    const detail = await sheet()
    for (const label of ['+ Foto', '+ Enlace', '+ Documento']) {
      expect(within(detail).getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('subir el PDF: sale mientras sube con su porcentaje y se guarda con su nombre (F3, F4)', async () => {
    const user = userEvent.setup()
    let finish: (path: string) => void = () => undefined
    vi.mocked(files.uploadItemFile).mockImplementation((_itemId, _checked, { onProgress }) => {
      onProgress(0.6)
      return new Promise((resolve) => {
        finish = resolve
      })
    })
    renderDetail(revolut())
    const detail = await sheet()

    await user.upload(
      within(detail).getByLabelText('Elegir documentos'),
      fileOf('Plan de ahorro Revolut.pdf', 'application/pdf'),
    )
    const box = within(detail).getByRole('region', { name: 'Documentos' })
    expect(within(box).getByText('Subiendo… 60 %')).toBeInTheDocument()
    expect(within(box).getByText('1 de 5')).toBeInTheDocument()
    // Con un documento, su botón se va de la fila.
    expect(within(detail).queryByRole('button', { name: '+ Documento' })).not.toBeInTheDocument()

    finish(`u/${REVOLUT}/x/Plan de ahorro Revolut.pdf`)
    await waitFor(() => {
      expect(itemsApi.insertFiles).toHaveBeenCalledWith([
        expect.objectContaining({
          item_id: REVOLUT,
          name: 'Plan de ahorro Revolut.pdf',
          mime: 'application/pdf',
          sizeBytes: 1258291,
        }),
      ])
    })
    await waitFor(() => {
      expect(box).toHaveTextContent('PDF · 1,2 MB')
    })
    expect(within(box).getByRole('button', { name: /Otro documento/ })).toBeInTheDocument()
  })

  it('lo que no vale no se sube y lo dice: grande, una foto, un .zip (X1–X3)', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderDetail(revolut())
    const detail = await sheet()
    const input = within(detail).getByLabelText('Elegir documentos')

    await user.upload(input, fileOf('Escrituras.pdf', 'application/pdf', 8 * 1024 * 1024))
    expect(within(detail).getByRole('alert')).toHaveTextContent(
      '“Escrituras.pdf” pesa 8 MB. El máximo es 5 MB.',
    )
    await user.upload(input, fileOf('Recibo.jpg', 'image/jpeg'))
    expect(within(detail).getByRole('alert')).toHaveTextContent(
      '“Recibo.jpg” es una foto. Añádela con «+ Foto».',
    )
    await user.upload(input, fileOf('Copias.zip', 'application/zip'))
    expect(within(detail).getByRole('alert')).toHaveTextContent(
      '“Copias.zip” no se puede adjuntar. Valen PDF, Word, Excel, PowerPoint, texto y CSV.',
    )
    expect(files.uploadItemFile).not.toHaveBeenCalled()
  })

  it('un .docx sin tipo vale por su extensión', async () => {
    const user = userEvent.setup()
    vi.mocked(files.uploadItemFile).mockResolvedValue('u/x/y/Condiciones.docx')
    renderDetail(revolut())
    const detail = await sheet()
    await user.upload(
      within(detail).getByLabelText('Elegir documentos'),
      fileOf('Condiciones.docx', ''),
    )
    await waitFor(() => {
      expect(itemsApi.insertFiles).toHaveBeenCalledWith([
        expect.objectContaining({
          mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      ])
    })
  })

  it('si no se pudo subir, se queda con «Reintentar» (X5)', async () => {
    const user = userEvent.setup()
    vi.mocked(files.uploadItemFile)
      .mockRejectedValueOnce(new Error('Sin conexión'))
      .mockResolvedValueOnce('u/x/y/Gastos.xlsx')
    renderDetail(revolut())
    const detail = await sheet()
    await user.upload(
      within(detail).getByLabelText('Elegir documentos'),
      fileOf('Gastos.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    )
    expect(await within(detail).findByText('No se pudo subir')).toBeInTheDocument()
    await user.click(within(detail).getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => {
      expect(itemsApi.insertFiles).toHaveBeenCalledTimes(1)
    })
    expect(within(detail).queryByText('No se pudo subir')).not.toBeInTheDocument()
  })

  it('tocar uno lo abre; su ··· deja quitarlo, con «Deshacer» (F4, F6, F7)', async () => {
    // El aviso va fuera de la hoja: en jsdom hereda el `pointer-events: none` del modal.
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const plan = doc(1, 'Plan de ahorro Revolut.pdf')
    renderDetail(revolut({ files: [plan, doc(2, 'Condiciones de la cuenta.pdf')] }))
    const box = within(await sheet()).getByRole('region', { name: 'Documentos' })

    expect(
      await within(box).findByRole('link', { name: 'Abrir Plan de ahorro Revolut.pdf' }),
    ).toHaveAttribute('href', `https://firmado/${plan.path}`)
    expect(within(box).getByText('2 de 5')).toBeInTheDocument()

    await user.click(
      within(box).getByRole('button', { name: 'Plan de ahorro Revolut.pdf: opciones' }),
    )
    const options = await screen.findByRole('dialog', { name: 'Plan de ahorro Revolut.pdf' })
    await user.click(within(options).getByRole('button', { name: 'Quitar' }))
    await waitFor(() => {
      expect(itemsApi.deleteFile).toHaveBeenCalledWith(plan.id)
    })
    expect(within(box).queryByText('Plan de ahorro Revolut.pdf')).not.toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'Deshacer' }))
    await waitFor(() => {
      expect(itemsApi.insertFiles).toHaveBeenCalledWith([
        expect.objectContaining({ id: plan.id, item_id: REVOLUT }),
      ])
    })
  })

  it('con 5, sin «Otro documento» y una línea que lo dice (X4)', async () => {
    renderDetail(revolut({ files: [1, 2, 3, 4, 5].map((n) => doc(n)) }))
    const box = within(await sheet()).getByRole('region', { name: 'Documentos' })
    expect(within(box).getByText('5 de 5')).toBeInTheDocument()
    expect(within(box).queryByRole('button', { name: /Otro documento/ })).not.toBeInTheDocument()
    expect(
      within(box).getByText('Has llegado a 5 documentos. Quita alguno para añadir otro.'),
    ).toBeInTheDocument()
  })

  it('en la lista, el clip con el número (6.2, diseño 29, L2)', async () => {
    const contrato: Item = {
      ...revolut(),
      id: '00000000-0000-4000-8000-000000000062',
      kind: 'note',
      title: 'Contrato del alquiler',
      notes: 'Firmado el 1 de marzo',
      position: 2000,
      files: [doc(1), doc(2)],
    }
    vi.mocked(listsApi.fetchLists).mockResolvedValue([casa])
    vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
    vi.mocked(itemsApi.fetchItems).mockReturnValue(new Promise(() => undefined))
    renderRoute('/lists/casa', {
      session,
      seed: (queryClient) => {
        queryClient.setQueryData(queryKeys.lists.all, [casa])
        queryClient.setQueryData(queryKeys.lists.archived, [])
        queryClient.setQueryData(queryKeys.items.byList('casa'), [
          revolut({ files: [doc(3)] }),
          contrato,
        ])
      },
    })

    const row = (await screen.findByText('Revisar el plan de ahorro de Revolut')).closest('li')
    expect(row).toHaveTextContent('1 documento')
    const nota = screen.getByText('Contrato del alquiler').closest('li')
    expect(nota).toHaveTextContent('2 documentos')
  })
})
