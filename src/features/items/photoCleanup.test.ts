import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// El de verdad (setup.ts lo sustituye para el resto de tests), con Supabase de mentira.
const { rpc, from, remove } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), remove: vi.fn() }))
vi.unmock('@/features/items/photoCleanup')
vi.mock('@/lib/supabase/client', () => ({ supabase: { rpc, storage: { from } } }))

const {
  cleanupPhotosDaily,
  CLEANUP_DELAY_MS,
  removeAllPhotos,
  removeOrphanPhotos,
  schedulePhotoCleanup,
} = await import('./photoCleanup')

beforeEach(() => {
  vi.resetAllMocks()
  remove.mockResolvedValue({ data: [], error: null })
  from.mockReturnValue({ remove })
  window.localStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
})

const paths = (count: number) => Array.from({ length: count }, (_, i) => `u1/i${i}/f.webp`)

describe('las fotos que ya no usa nadie (2.8)', () => {
  it('borra lo que dice la base, de cien en cien', async () => {
    rpc.mockResolvedValue({ data: paths(230), error: null })
    expect(await removeOrphanPhotos()).toBe(230)
    expect(rpc).toHaveBeenCalledWith('orphan_photos')
    expect(from).toHaveBeenCalledWith('item-images')
    expect(remove.mock.calls.map((call) => (call[0] as string[]).length)).toEqual([100, 100, 30])
  })

  it('sin huérfanas no borra nada; si Storage falla, lo dice', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    expect(await removeOrphanPhotos()).toBe(0)
    expect(remove).not.toHaveBeenCalled()

    rpc.mockResolvedValue({ data: paths(1), error: null })
    remove.mockResolvedValue({ data: null, error: new Error('403') })
    await expect(removeOrphanPhotos()).rejects.toThrow('403')
  })

  it('para borrar la cuenta, todas las tuyas', async () => {
    rpc.mockResolvedValue({ data: paths(3), error: null })
    await removeAllPhotos()
    expect(rpc).toHaveBeenCalledWith('own_photos')
    expect(remove).toHaveBeenCalledWith(paths(3))
  })

  it('varias peticiones seguidas se quedan en una, pasado el «Deshacer»', async () => {
    vi.useFakeTimers()
    rpc.mockResolvedValue({ data: [], error: null })
    schedulePhotoCleanup()
    await vi.advanceTimersByTimeAsync(10_000)
    schedulePhotoCleanup()
    await vi.advanceTimersByTimeAsync(CLEANUP_DELAY_MS - 1)
    expect(rpc).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('al abrir la app, una vez al día', async () => {
    vi.useFakeTimers()
    rpc.mockResolvedValue({ data: [], error: null })
    const now = Date.UTC(2026, 9, 5, 10)
    cleanupPhotosDaily(now)
    await vi.advanceTimersByTimeAsync(CLEANUP_DELAY_MS)
    cleanupPhotosDaily(now + 60 * 60 * 1000)
    await vi.advanceTimersByTimeAsync(CLEANUP_DELAY_MS)
    expect(rpc).toHaveBeenCalledTimes(1)
    cleanupPhotosDaily(now + 25 * 60 * 60 * 1000)
    await vi.advanceTimersByTimeAsync(CLEANUP_DELAY_MS)
    expect(rpc).toHaveBeenCalledTimes(2)
  })
})
