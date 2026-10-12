import { describe, expect, it } from 'vitest'

import { deviceKeyLabel, passwordsApp, unsupportedNote } from './copy'
import { deviceUnlock } from './passkey'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1'
const IPAD =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.4 Safari/605.1.15'
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/141.0 Safari/537.36'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36'
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36'

describe('cómo se llama el desbloqueo en cada aparato (diseño 26)', () => {
  it.each([
    [IPHONE, 0, 'Face ID en este iPhone'],
    [IPAD, 5, 'Face ID en este iPad'],
    [MAC, 0, 'Touch ID en este Mac'],
    [ANDROID, 5, 'Huella en este móvil'],
    [WINDOWS, 0, 'Windows Hello en este ordenador'],
    ['Mozilla/5.0 (X11; Linux x86_64)', 0, 'Llave de acceso en este ordenador'],
  ])('%#: «%s»', (agent, touch, label) => {
    expect(deviceKeyLabel(deviceUnlock(agent, touch))).toBe(label)
  })

  it('sin llave, lo dice con su nombre; la app Contraseñas solo donde la hay', () => {
    expect(unsupportedNote(deviceUnlock(WINDOWS, 0))).toBe(
      'Este navegador no permite desbloquear con Windows Hello. Aquí se desbloquea con la clave.',
    )
    expect(unsupportedNote(deviceUnlock(ANDROID, 5))).toBe(
      'Este navegador no permite desbloquear con la huella. Aquí se desbloquea con la clave.',
    )
    expect(passwordsApp(deviceUnlock(IPHONE, 0))).toBe('la app Contraseñas del iPhone')
    expect(passwordsApp(deviceUnlock(WINDOWS, 0))).toBe('un gestor de contraseñas')
  })
})
