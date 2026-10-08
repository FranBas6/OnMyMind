import { createContext, use } from 'react'

/** Lo que la app sabe de sí misma como app instalable (diseño 10, `src/app/pwa.tsx`). */
export interface PwaApi {
  /** Cuándo se hizo la versión que tienes. */
  buildTime: Date
  /** Hay una versión nueva esperando a que le des a «Actualizar». */
  updateAvailable: boolean
  /** Cuándo se hizo la nueva, si se sabe. */
  newBuildTime: Date | null
  checking: boolean
  /** La última vez que se buscó una versión nueva. */
  lastCheckedAt: Date | null
  /** La última búsqueda no pudo hacerse (sin respuesta del servidor). */
  checkFailed: boolean
  checkForUpdate: () => void
  /** Activa la versión nueva y recarga. */
  applyUpdate: () => void
  /** Safari de iOS sin la app instalada: se puede instalar (fila de Perfil y hoja). */
  canInstall: boolean
  installOpen: boolean
  openInstall: () => void
  /** «Lo haré después» (o la ×) vuelve a los siete días; «No volver a mostrar», nunca. */
  closeInstall: (choice: 'later' | 'never') => void
  /** La app ya está instalada: abierta como app, o instalada ahora desde el navegador (4.2). */
  installed: boolean
  /**
   * El navegador sabe instalar la app y aún no está instalada (Chrome o Edge, en Android o en el
   * ordenador; 4.2): «Instalar la app» abre su instalador.
   */
  canPromptInstall: boolean
  /** Abre el instalador del navegador. `accepted` si se instaló; `null` si ya no se puede. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | null>
}

const noop = () => undefined

/** Sin `PwaProvider` (tests, o un navegador sin service worker): todo quieto. */
const STILL: PwaApi = {
  buildTime: new Date(__APP_BUILD_TIME__),
  updateAvailable: false,
  newBuildTime: null,
  checking: false,
  lastCheckedAt: null,
  checkFailed: false,
  checkForUpdate: noop,
  applyUpdate: noop,
  canInstall: false,
  installOpen: false,
  openInstall: noop,
  closeInstall: noop,
  installed: false,
  canPromptInstall: false,
  promptInstall: () => Promise.resolve(null),
}

export const PwaContext = createContext<PwaApi | null>(null)

export function usePwa(): PwaApi {
  return use(PwaContext) ?? STILL
}
