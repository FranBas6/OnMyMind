import { createContext, use, useState, useSyncExternalStore } from 'react'

/**
 * El ancho de la barra lateral y del panel de detalle en escritorio, que se ajustan arrastrando su
 * borde (Fran, 2026-11-16). Se recuerdan en este navegador (`localStorage`): es una preferencia de
 * la pantalla, no de la cuenta.
 */

export interface WidthSpec {
  min: number
  max: number
  initial: number
  key: string
}

/**
 * La barra lateral solo crece: con menos de 272 px, «+ ¿Qué tienes en mente? ⌘⇧␣» ya no cabe entero.
 */
export const SIDEBAR_WIDTH: WidthSpec = {
  min: 272,
  max: 400,
  initial: 272,
  key: 'omm.layout.sidebar',
}
export const PANEL_WIDTH: WidthSpec = { min: 360, max: 720, initial: 420, key: 'omm.layout.panel' }
/** El contenido nunca baja de aquí: los paneles se quedan más estrechos antes. */
export const MIN_MAIN_WIDTH = 560
/** El ancho máximo de la app: en pantallas más anchas, todo junto y centrado. */
export const MAX_APP_WIDTH = 1760

/** Entre su mínimo y el menor de su máximo y el sitio que queda (`room`). */
export function clampWidth(value: number, spec: WidthSpec, room: number = spec.max): number {
  const max = Math.max(spec.min, Math.min(spec.max, room))
  return Math.round(Math.min(Math.max(value, spec.min), max))
}

export function readWidth(spec: WidthSpec): number {
  try {
    const stored = Number(localStorage.getItem(spec.key))
    return Number.isFinite(stored) && stored > 0 ? clampWidth(stored, spec) : spec.initial
  } catch {
    return spec.initial
  }
}

function saveWidth(spec: WidthSpec, value: number): void {
  try {
    if (value === spec.initial) localStorage.removeItem(spec.key)
    else localStorage.setItem(spec.key, String(value))
  } catch {
    // Sin almacenamiento (privado, bloqueado): vale para esta visita.
  }
}

function subscribeResize(onChange: () => void) {
  window.addEventListener('resize', onChange)
  return () => {
    window.removeEventListener('resize', onChange)
  }
}

export interface LayoutWidths {
  sidebar: number
  panel: number
  /** Hasta dónde llega cada uno ahora, con el ancho de la ventana. */
  sidebarMax: number
  panelMax: number
  setSidebar: (width: number) => void
  setPanel: (width: number) => void
}

/**
 * Los dos anchos, ajustados a la ventana: el de la app (como mucho 1760 px) menos el otro panel y
 * el contenido mínimo. La barra lateral cuenta con el panel en su mínimo, que puede abrirse.
 */
export function useLayoutWidthsState(): LayoutWidths {
  const [sidebarStored, setSidebarStored] = useState(() => readWidth(SIDEBAR_WIDTH))
  const [panelStored, setPanelStored] = useState(() => readWidth(PANEL_WIDTH))
  const viewport = useSyncExternalStore(
    subscribeResize,
    () => window.innerWidth,
    () => MAX_APP_WIDTH,
  )
  const app = Math.min(viewport, MAX_APP_WIDTH)
  const sidebarMax = clampWidth(
    SIDEBAR_WIDTH.max,
    SIDEBAR_WIDTH,
    app - MIN_MAIN_WIDTH - PANEL_WIDTH.min,
  )
  const sidebar = Math.min(sidebarStored, sidebarMax)
  const panelMax = clampWidth(PANEL_WIDTH.max, PANEL_WIDTH, app - sidebar - MIN_MAIN_WIDTH)
  const panel = Math.min(panelStored, panelMax)

  return {
    sidebar,
    panel,
    sidebarMax,
    panelMax,
    setSidebar: (width) => {
      const next = clampWidth(width, SIDEBAR_WIDTH, sidebarMax)
      setSidebarStored(next)
      saveWidth(SIDEBAR_WIDTH, next)
    },
    setPanel: (width) => {
      const next = clampWidth(width, PANEL_WIDTH, panelMax)
      setPanelStored(next)
      saveWidth(PANEL_WIDTH, next)
    },
  }
}

/** Fuera de `AppShell` (piezas sueltas en tests), los anchos de siempre y sin ajustar. */
const fixed: LayoutWidths = {
  sidebar: SIDEBAR_WIDTH.initial,
  panel: PANEL_WIDTH.initial,
  sidebarMax: SIDEBAR_WIDTH.max,
  panelMax: PANEL_WIDTH.max,
  setSidebar: () => undefined,
  setPanel: () => undefined,
}

export const LayoutWidthsContext = createContext<LayoutWidths>(fixed)

export function useLayoutWidths(): LayoutWidths {
  return use(LayoutWidthsContext)
}
