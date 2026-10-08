import { vi } from 'vitest'

/**
 * Navegadores de verdad para los tests que dependen del aparato (4.2): jsdom no se presenta como
 * ninguno («Mozilla/5.0 (darwin) … jsdom»), así que cuenta como «lo demás». `vi.restoreAllMocks()`
 * lo devuelve a su sitio.
 */
export const USER_AGENTS = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
} as const

export function pretendDevice(device: keyof typeof USER_AGENTS): void {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(USER_AGENTS[device])
}
