import { onlineManager } from '@tanstack/react-query'
import { RotateCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'

import { UndoToast } from '@/components/UndoToast'
import { PwaContext, type PwaApi } from '@/hooks/usePwa'
import type { InstallPromptEvent } from '@/lib/device'
import { isIosSafari, isStandalone, readInstallHint, writeInstallHint } from '@/lib/installHint'

/** Cada cuánto se busca una versión nueva con la app abierta (además de al abrirla). */
const CHECK_EVERY_MS = 60 * 60 * 1000
/** Lo mínimo que se ve «Buscando…», para que el botón dé señal aunque la respuesta sea inmediata. */
const MIN_CHECK_MS = 600
const UPDATE_TOAST_ID = 'app-update'

/** Cuándo se hizo la versión publicada (`/version.json`, fuera del precache). */
async function fetchPublishedBuildTime(): Promise<Date | null> {
  try {
    const response = await fetch('/version.json', { cache: 'no-store' })
    if (!response.ok) return null
    const body = (await response.json()) as { builtAt?: unknown }
    return typeof body.builtAt === 'string' ? new Date(body.builtAt) : null
  } catch {
    return null
  }
}

/**
 * La app como app instalable (1.15, diseño 10). Registra el service worker en modo `prompt`: una
 * versión nueva se instala en segundo plano y se queda esperando; aquí se avisa con «Hay una
 * versión nueva · Actualizar», que se queda hasta que actúas o lo deslizas, y «Actualizar» la
 * activa y recarga. También busca versiones nuevas cada hora y cuando se lo pides desde Perfil,
 * y lleva el estado de la hoja «Instalar en el iPhone».
 */
export function PwaProvider({ children }: { children: ReactNode }) {
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkFailed, setCheckFailed] = useState(false)
  // Sin service worker (en `pnpm dev`, o un navegador sin soporte), la versión nueva se sabe
  // comparando con `/version.json`, y «Actualizar» es recargar.
  const [newerPublished, setNewerPublished] = useState(false)
  const [newBuildTime, setNewBuildTime] = useState<Date | null>(null)
  const [installOpen, setInstallOpen] = useState(false)
  const [canInstall] = useState(
    () => isIosSafari(navigator.userAgent, navigator.maxTouchPoints) && !isStandalone(),
  )
  const [installed, setInstalled] = useState(isStandalone)
  // El instalador del navegador (4.2): se guarda el evento para abrirlo cuando se toque la fila.
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)

  useEffect(() => {
    const keep = (event: Event) => {
      // Sin la barra de Chrome que sale sola: se instala desde Perfil · App.
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const done = () => {
      setInstallPrompt(null)
      setInstalled(true)
    }
    window.addEventListener('beforeinstallprompt', keep)
    window.addEventListener('appinstalled', done)
    return () => {
      window.removeEventListener('beforeinstallprompt', keep)
      window.removeEventListener('appinstalled', done)
    }
  }, [])

  /**
   * El evento solo sirve una vez: aceptado o no, se suelta. Si se cancela, la fila vuelve cuando el
   * navegador lo ofrezca otra vez (al volver a abrir la app).
   */
  const promptInstall = useCallback(async () => {
    if (!installPrompt) return null
    setInstallPrompt(null)
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    return outcome
  }, [installPrompt])

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, reg) => {
      registration.current = reg
      // El navegador acaba de comprobar si hay versión nueva al registrar.
      setLastCheckedAt(new Date())
    },
  })

  const updateAvailable = needRefresh || newerPublished

  /**
   * Con service worker, `registration.update()`: si hay versión nueva, se instala y `needRefresh`
   * lo avisa. Sin él, se compara la fecha de esta versión con la publicada. En los dos casos se
   * enseña «Buscando…» un momento y, si no hubo respuesta, «No se ha podido comprobar».
   */
  const checkForUpdate = useCallback(() => {
    if (!onlineManager.isOnline()) return
    setChecking(true)
    const started = Date.now()
    const reg = registration.current
    const check: Promise<boolean> = reg
      ? reg.update().then(
          () => true,
          () => false,
        )
      : fetchPublishedBuildTime().then((published) => {
          if (!published) return false
          if (published.getTime() > new Date(__APP_BUILD_TIME__).getTime()) {
            setNewerPublished(true)
            setNewBuildTime(published)
          }
          return true
        })
    void check.then((ok) => {
      const wait = Math.max(0, MIN_CHECK_MS - (Date.now() - started))
      window.setTimeout(() => {
        setChecking(false)
        setCheckFailed(!ok)
        if (ok) setLastCheckedAt(new Date())
      }, wait)
    })
  }, [])

  // Cada hora, con la app abierta y con red.
  useEffect(() => {
    const timer = window.setInterval(checkForUpdate, CHECK_EVERY_MS)
    return () => {
      window.clearInterval(timer)
    }
  }, [checkForUpdate])

  const applyUpdate = useCallback(() => {
    toast.dismiss(UPDATE_TOAST_ID)
    if (needRefresh) void updateServiceWorker(true)
    else window.location.reload()
  }, [needRefresh, updateServiceWorker])

  // Versión nueva esperando: de cuándo es y el aviso, que se queda hasta que actúas.
  useEffect(() => {
    if (!updateAvailable) return
    void fetchPublishedBuildTime().then(setNewBuildTime)
    const desktop = window.matchMedia('(min-width: 768px)').matches
    toast.custom(
      () => (
        <UndoToast
          icon={desktop ? RotateCw : undefined}
          message={desktop ? 'Hay una versión nueva' : 'Versión nueva'}
          actionLabel="Actualizar"
          onUndo={applyUpdate}
        />
      ),
      { id: UPDATE_TOAST_ID, duration: Infinity, position: 'bottom-center' },
    )
  }, [updateAvailable, applyUpdate])

  const closeInstall = useCallback((choice: 'later' | 'never') => {
    const record = readInstallHint()
    writeInstallHint({
      shown: record.shown,
      dismissedAt: new Date().toISOString(),
      never: record.never || choice === 'never',
    })
    setInstallOpen(false)
  }, [])

  const api = useMemo<PwaApi>(
    () => ({
      buildTime: new Date(__APP_BUILD_TIME__),
      updateAvailable,
      newBuildTime,
      checking,
      lastCheckedAt,
      checkFailed,
      checkForUpdate,
      applyUpdate,
      canInstall,
      installOpen,
      openInstall: () => {
        setInstallOpen(true)
      },
      closeInstall,
      installed,
      canPromptInstall: installPrompt !== null,
      promptInstall,
    }),
    [
      updateAvailable,
      newBuildTime,
      checking,
      lastCheckedAt,
      checkFailed,
      checkForUpdate,
      applyUpdate,
      canInstall,
      installOpen,
      closeInstall,
      installed,
      installPrompt,
      promptInstall,
    ],
  )

  return <PwaContext value={api}>{children}</PwaContext>
}
