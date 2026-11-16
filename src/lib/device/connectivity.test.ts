import { onlineManager } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PROBE_INTERVAL_MS, watchConnectivity } from './connectivity'

let browserOnline = true

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => browserOnline)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  browserOnline = true
  onlineManager.setOnline(true)
})

describe('que «Sin conexión» no se quede puesto con red (connectivity.ts)', () => {
  it('si el navegador dice que no hay red pero el servidor contesta, hay red', async () => {
    browserOnline = false
    onlineManager.setOnline(false)
    const probe = vi.fn().mockResolvedValue(true)
    const stop = watchConnectivity(probe)
    await vi.advanceTimersByTimeAsync(0)
    expect(probe).toHaveBeenCalledTimes(1)
    expect(onlineManager.isOnline()).toBe(true)
    stop()
  })

  it('sin red de verdad, sigue sin red y vuelve a mirar cada rato mientras se ve', async () => {
    browserOnline = false
    onlineManager.setOnline(false)
    const probe = vi.fn().mockResolvedValue(false)
    const stop = watchConnectivity(probe)
    await vi.advanceTimersByTimeAsync(0)
    expect(onlineManager.isOnline()).toBe(false)

    // Vuelve la red, pero el navegador no avisa: la siguiente vuelta lo ve.
    probe.mockResolvedValue(true)
    await vi.advanceTimersByTimeAsync(PROBE_INTERVAL_MS)
    expect(onlineManager.isOnline()).toBe(true)
    expect(probe).toHaveBeenCalledTimes(2)

    // Con red, no pregunta más.
    await vi.advanceTimersByTimeAsync(PROBE_INTERVAL_MS * 3)
    expect(probe).toHaveBeenCalledTimes(2)
    stop()
  })

  it('un «offline» del navegador con el servidor contestando no deja la app sin red', async () => {
    const probe = vi.fn().mockResolvedValue(true)
    const stop = watchConnectivity(probe)
    await vi.advanceTimersByTimeAsync(0)
    expect(probe).not.toHaveBeenCalled()

    browserOnline = false
    window.dispatchEvent(new Event('offline'))
    await vi.advanceTimersByTimeAsync(0)
    expect(probe).toHaveBeenCalledTimes(1)
    expect(onlineManager.isOnline()).toBe(true)
    stop()
  })

  it('al volver a la app, se vuelve a mirar', async () => {
    browserOnline = false
    onlineManager.setOnline(false)
    const probe = vi.fn().mockResolvedValue(false)
    const stop = watchConnectivity(probe)
    await vi.advanceTimersByTimeAsync(0)

    browserOnline = true
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(0)
    expect(onlineManager.isOnline()).toBe(true)
    stop()
  })

  it('parado, ya no escucha ni pregunta', async () => {
    browserOnline = false
    onlineManager.setOnline(false)
    const probe = vi.fn().mockResolvedValue(false)
    const stop = watchConnectivity(probe)
    await vi.advanceTimersByTimeAsync(0)
    stop()
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(PROBE_INTERVAL_MS * 2)
    expect(probe).toHaveBeenCalledTimes(1)
  })
})
