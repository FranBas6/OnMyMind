import '@/styles/globals.css'

import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { configureDateLocale } from '@/lib/date'

import { createQueryClient } from './query-client'
import { createAppRouter } from './router'

configureDateLocale()

const queryClient = createQueryClient()
const router = createAppRouter({ queryClient })

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('No se encontró el elemento #root en index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
