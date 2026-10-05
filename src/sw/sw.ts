/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

import { isSkipWaiting, parsePush, safePath } from './push'

/**
 * El service worker de la app (04 §PWA y service worker). Desde la 2.6 lo escribimos nosotros
 * (`injectManifest`) en vez de generarlo entero (`generateSW`), para poder recibir los push. Hace
 * lo mismo que hacía el generado:
 * - precachea la app shell (la lista la inyecta el plugin en `__WB_MANIFEST`) y borra lo viejo;
 * - sirve cualquier navegación con el `index.html` precacheado, salvo `/auth/*` (08 A.7);
 * - en modo `prompt`, la versión nueva espera hasta que la app pide `SKIP_WAITING` («Actualizar»).
 * Y además enseña los avisos y, al tocar uno, abre su ítem.
 */
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (PrecacheEntry | string)[]
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/auth\//] }),
)

self.addEventListener('message', (event) => {
  if (isSkipWaiting(event.data)) void self.skipWaiting()
})

self.addEventListener('push', (event) => {
  const message = parsePush(event.data?.text())
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      icon: '/logos/png/pwa-icon-192.png',
      data: { url: message.url },
    }),
  )
})

// Al tocar el aviso: si la app ya está abierta, se trae delante y va al ítem; si no, se abre ahí.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data as { url?: string } | null
  const url = safePath(data?.url)
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows[0]
      if (open) {
        await open.focus()
        await open.navigate(url)
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})
