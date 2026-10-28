import '@/styles/globals.css'

import { onlineManager } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { z } from 'zod'

import { getSession } from '@/features/auth'
import { watchConnectivity } from '@/lib/connectivity'
import { configureDateLocale } from '@/lib/date'

import { restoreQueryCache } from './persister'
import { createQueryClient } from './query-client'
import { createAppRouter } from './router'

configureDateLocale()

// Sin `new Function`: la Content Security Policy no deja evaluar código (5.6), y zod lo probaría.
z.config({ jitless: true })

// TanStack Query supone que hay red hasta que llega un evento `offline`: si la app se abre ya sin
// conexión (modo avión), ese evento no llega nunca. Se parte de lo que diga el navegador y, si dice
// que no hay red, se comprueba con el servidor, ahora y cada vez que haga falta (`connectivity.ts`).
onlineManager.setOnline(navigator.onLine)
watchConnectivity()

const queryClient = createQueryClient()
const router = createAppRouter({ queryClient, getSession })

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('No se encontró el elemento #root en index.html')
}
const root = createRoot(rootElement)

// Primero la caché guardada (sin red, la app abre con tus listas) y después la app.
void restoreQueryCache(queryClient).then(() => {
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
})
