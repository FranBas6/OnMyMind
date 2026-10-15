import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import { queryKeys } from '@/lib/queryKeys'

import { createLiveSync, liveChangeSchema, sessionIdOf, type LiveChange } from './live'
import * as liveRows from './liveRows'

const ME = 'fran'
const BEA = 'bea'
/** Fran en este dispositivo; en el iPhone tiene otra sesión. */
const HERE = { userId: ME, sessionId: 'mac' }

const items = (
  by: string | null,
  extra: Partial<LiveChange> = {},
  session: string | null = by === ME ? 'mac' : 'otra',
): LiveChange =>
  liveChangeSchema.parse({
    kind: 'items',
    list_id: 'compras',
    by,
    session,
    added: [],
    completed: [],
    ...extra,
  })

/** Una mutación en vuelo que termina cuando se quiera. */
function startMutation(queryClient: QueryClient) {
  let finish: (value: undefined) => void = () => undefined
  const done = new Promise<undefined>((resolve) => {
    finish = resolve
  })
  void queryClient
    .getMutationCache()
    .build(queryClient, { mutationFn: () => done })
    .execute(undefined)
  return () => {
    finish(undefined)
  }
}

describe('en directo: qué se vuelve a pedir (3.4)', () => {
  let queryClient: QueryClient
  let invalidate: MockInstance<QueryClient['invalidateQueries']>
  let now: number

  beforeEach(() => {
    vi.useFakeTimers()
    now = 1_000_000
    queryClient = new QueryClient()
    invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    liveRows.resetLiveRows()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const invalidated = () =>
    invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey))

  it('lo que hace Bea vuelve a pedir las filas y los contadores, una vez por ráfaga', () => {
    const sync = createLiveSync(queryClient, HERE, { now: () => now })
    sync.receive(items(BEA))
    sync.receive(items(BEA))
    sync.receive(liveChangeSchema.parse({ kind: 'list', list_id: 'compras', by: BEA }))
    expect(invalidate).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(invalidated()).toEqual([
      '["items"]',
      JSON.stringify(queryKeys.lists.all),
      JSON.stringify(queryKeys.reminders),
      JSON.stringify(queryKeys.sharing.shared),
    ])
  })

  it('con cambios propios por enviar, espera a que terminen (la cola de la 2.10)', async () => {
    const sync = createLiveSync(queryClient, HERE, { now: () => now })
    const finish = startMutation(queryClient)
    sync.receive(items(BEA))
    vi.advanceTimersByTime(1_000)
    expect(invalidate).not.toHaveBeenCalled()

    finish()
    await vi.runAllTimersAsync()
    expect(invalidated()).toContain('["items"]')
  })

  it('lo propio que vuelve por el canal no se pide otra vez en este dispositivo', async () => {
    const sync = createLiveSync(queryClient, HERE, { now: () => now })
    const finish = startMutation(queryClient)
    sync.receive(items(ME))
    finish()
    await vi.runAllTimersAsync()
    now += 1_000
    sync.receive(items(ME))
    await vi.runAllTimersAsync()
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('lo propio hecho en otro dispositivo sí, aunque aquí acabes de cambiar algo', async () => {
    const sync = createLiveSync(queryClient, HERE, { now: () => now })
    const finish = startMutation(queryClient)
    finish()
    await vi.runAllTimersAsync()
    invalidate.mockClear()
    sync.receive(items(ME, {}, 'iphone'))
    await vi.runAllTimersAsync()
    expect(invalidated()).toContain('["items"]')
  })

  it('en otra pestaña con la misma sesión, también (ahí no se cambió nada)', () => {
    const sync = createLiveSync(queryClient, HERE, { now: () => now })
    sync.receive(items(ME))
    vi.advanceTimersByTime(200)
    expect(invalidated()).toContain('["items"]')
  })

  it('alguien entra o sale: las iniciales, las listas y lo de dentro de esa lista', () => {
    const sync = createLiveSync(queryClient, HERE, { now: () => now })
    sync.receive(liveChangeSchema.parse({ kind: 'people', list_id: 'compras', by: null }))
    vi.advanceTimersByTime(200)
    expect(invalidated()).toEqual([
      JSON.stringify(queryKeys.sharing.shared),
      JSON.stringify(queryKeys.sharing.people('compras')),
      JSON.stringify(queryKeys.lists.all),
      JSON.stringify(queryKeys.items.byList('compras')),
    ])
  })

  it('la sesión sale del token de Supabase', () => {
    const payload = btoa(JSON.stringify({ sub: ME, session_id: 'abc-123' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(sessionIdOf(`cabecera.${payload}.firma`)).toBe('abc-123')
    expect(sessionIdOf('no-es-un-token')).toBeNull()
  })

  it('que te quiten o se archive la lista pide el porqué, aunque estés cambiando algo', async () => {
    const sync = createLiveSync(queryClient, HERE, { now: () => now })
    sync.receive(
      liveChangeSchema.parse({
        kind: 'departure',
        list_id: 'compras',
        by: BEA,
        reason: 'removed',
      }),
    )
    await vi.runAllTimersAsync()
    expect(invalidated()[0]).toBe(JSON.stringify(queryKeys.sharing.departure('compras')))
    expect(invalidated()).toContain(JSON.stringify(queryKeys.lists.all))
  })

  it('ocultar o mostrar en otro aparato (5.8): las listas, lo de dentro y el perfil', async () => {
    const sync = createLiveSync(queryClient, HERE, { now: () => now })
    sync.receive(liveChangeSchema.parse({ kind: 'hidden', list_id: 'regalos', by: ME }))
    await vi.runAllTimersAsync()
    expect(invalidated()).toEqual([
      JSON.stringify(queryKeys.lists.all),
      '["items"]',
      JSON.stringify(queryKeys.profile()),
    ])
  })

  it('al volver la conexión, se pide de nuevo lo que se ve', () => {
    const sync = createLiveSync(queryClient, HERE, { now: () => now })
    sync.catchUp()
    vi.advanceTimersByTime(200)
    expect(invalidated()).toEqual([
      '["items"]',
      JSON.stringify(queryKeys.lists.all),
      JSON.stringify(queryKeys.sharing.shared),
      JSON.stringify(queryKeys.reminders),
    ])
  })

  it('lo que añade o termina Bea se nota en su fila; lo de la base (precios) y lo tuyo, no', () => {
    const arrived = vi.spyOn(liveRows, 'markArrived')
    const completed = vi.spyOn(liveRows, 'markCompleted')
    const sync = createLiveSync(queryClient, HERE, { now: () => now })
    sync.receive(items(BEA, { added: ['tomates'], completed: ['papel'] }))
    sync.receive(items(null, { completed: ['otro'] }))
    sync.receive(items(ME, { added: ['mio'] }))
    expect(arrived.mock.calls).toEqual([[['tomates']]])
    expect(completed.mock.calls).toEqual([[['papel']]])
  })

  it('un mensaje que no se entiende no rompe nada', () => {
    expect(liveChangeSchema.safeParse({ kind: 'otra-cosa' }).success).toBe(false)
  })
})
