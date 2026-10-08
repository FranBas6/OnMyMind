import { describe, expect, it } from 'vitest'

import type { Item } from '@/features/items/types'

import { csvCell, csvOrder, exportDocument, exportFileName, listCsv, listFileName } from './export'

let next = 0
function item(title: string, overrides: Partial<Item> = {}): Item {
  next += 1
  return {
    id: `i${next}`,
    listId: 'casa',
    kind: 'task',
    parentId: null,
    title,
    notes: null,
    status: 'pending',
    priority: null,
    dueAt: null,
    allDay: true,
    recurrence: null,
    position: next * 1000,
    completedAt: null,
    createdAt: new Date(2026, 8, 20, 18, 5),
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

const NOW = new Date(2026, 9, 5, 12, 0)

describe('los nombres de los archivos', () => {
  it('el JSON lleva el día; el CSV, la lista sin tildes ni símbolos', () => {
    expect(exportFileName(NOW)).toBe('onmymind-2026-10-05.json')
    expect(listFileName({ name: 'Casa' }, NOW)).toBe('onmymind-casa-2026-10-05.csv')
    expect(listFileName({ name: 'Viaje a Japón ✈️ 2027' }, NOW)).toBe(
      'onmymind-viaje-a-japon-2027-2026-10-05.csv',
    )
    expect(listFileName({ name: '🎁' }, NOW)).toBe('onmymind-lista-2026-10-05.csv')
  })
})

describe('el JSON', () => {
  it('lleva todo tal cual y cada foto como enlace', () => {
    const document = exportDocument(
      {
        profile: { id: 'u1', settings: { theme: 'dark' } },
        lists: [
          { id: 'casa', name: 'Casa', owner_id: 'u1' },
          { id: 'compras', name: 'Compras de Ana', owner_id: 'ana' },
        ],
        items: [
          { id: 'a', title: 'Con foto', image_path: 'u1/a/foto.webp' },
          { id: 'b', title: 'Sin foto', image_path: null },
        ],
        itemLinks: [],
        itemImages: [
          { id: 'f1', item_id: 'a', path: 'u1/a/foto.webp', position: 1000 },
          { id: 'f2', item_id: 'a', path: 'u1/a/otra.webp', position: 2000 },
        ],
        itemPrices: [{ id: 'p', price_cents: 1250 }],
        reminders: [{ id: 'r', offset_minutes: 60 }],
        itemCompletions: [{ id: 'c', item_id: 'a' }],
      },
      new Map([
        ['u1/a/foto.webp', 'https://firmada/foto'],
        ['u1/a/otra.webp', 'https://firmada/otra'],
      ]),
      NOW,
    )
    expect(document).toMatchObject({
      app: 'OnMyMind',
      format: 2,
      exported_at: NOW.toISOString(),
      profile: { settings: { theme: 'dark' } },
      // Las compartidas contigo van también, marcadas (3.3).
      lists: [
        { name: 'Casa', created_by_me: true },
        { name: 'Compras de Ana', created_by_me: false },
      ],
      item_prices: [{ price_cents: 1250 }],
      reminders: [{ offset_minutes: 60 }],
      item_completions: [{ item_id: 'a' }],
    })
    expect(document.items).toEqual([
      {
        id: 'a',
        title: 'Con foto',
        image_path: 'u1/a/foto.webp',
        photo_url: 'https://firmada/foto',
      },
      { id: 'b', title: 'Sin foto', image_path: null },
    ])
    // Todas las fotos de cada cosa, cada una con su enlace (4.5).
    expect(document.item_images.map((image) => image.photo_url)).toEqual([
      'https://firmada/foto',
      'https://firmada/otra',
    ])
  })
})

describe('el CSV de una lista', () => {
  it('una celda va entre comillas si lleva ; comillas o saltos, y nunca como fórmula', () => {
    expect(csvCell('Leche')).toBe('Leche')
    expect(csvCell('Pan; huevos')).toBe('"Pan; huevos"')
    expect(csvCell('Dice "hola"')).toBe('"Dice ""hola"""')
    expect(csvCell('Dos\nlíneas')).toBe('"Dos\nlíneas"')
    expect(csvCell('=SUMA(A1)')).toBe("'=SUMA(A1)")
    expect(csvCell('- leche')).toBe('- leche')
  })

  it('lo de una sublista va justo debajo, con su nombre en «Sublista» (diseño 18, P8)', () => {
    const roma = item('Roma', { kind: 'sublist', position: 2000 })
    const rows = csvOrder([
      item('Billetes', { parentId: roma.id, position: 100 }),
      item('Arriba', { position: 1000 }),
      roma,
      item('Abajo', { position: 3000 }),
      item('Hotel', { parentId: roma.id, position: 50 }),
    ])
    expect(rows.map((row) => [row.item.title, row.sublist])).toEqual([
      ['Arriba', null],
      ['Roma', null],
      ['Hotel', 'Roma'],
      ['Billetes', 'Roma'],
      ['Abajo', null],
    ])
  })

  it('cabecera y filas en español, con punto y coma, BOM y CRLF', () => {
    const csv = listCsv([
      item('Pagar el alquiler', { dueAt: new Date(2026, 9, 7), priority: 'high' }),
      item('Dentista', {
        kind: 'event',
        status: 'upcoming',
        dueAt: new Date(2026, 9, 8, 10, 0),
        allDay: false,
        recurrence: 'yearly',
        notes: 'Llevar la tarjeta; y el DNI',
      }),
      item('Camiseta', {
        kind: 'shopping',
        status: 'bought',
        priceCents: 10050,
        priceStore: 'Tienda del Madrid',
        priceTracking: null,
        url: 'https://shop.realmadrid.com/camiseta',
        completedAt: new Date(2026, 9, 1, 9, 30),
      }),
    ])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const lines = csv.slice(1).split('\r\n')
    expect(lines[0]).toBe(
      'Título;Sublista;Tipo;Estado;Prioridad;Fecha;Hora;Repetición;Notas;Enlace;Precio;Moneda;Tienda;Creado;Terminado',
    )
    expect(lines[1]).toBe(
      'Pagar el alquiler;;Tarea;Pendiente;Alta;07/10/2026;;;;;;;;20/09/2026 18:05;',
    )
    expect(lines[2]).toBe(
      'Dentista;;Evento;Próximo;;08/10/2026;10:00;Cada año;"Llevar la tarjeta; y el DNI";;;;;20/09/2026 18:05;',
    )
    expect(lines[3]).toBe(
      'Camiseta;;Compra;Comprado;;;;;;https://shop.realmadrid.com/camiseta;100,50;EUR;Tienda del Madrid;20/09/2026 18:05;01/10/2026 09:30',
    )
    expect(lines[4]).toBe('')
  })
})
