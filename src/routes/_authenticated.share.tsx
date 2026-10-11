import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { useShareTarget } from '@/features/capture'

/**
 * `/share?title=…&text=…&url=…`: compartir a OnMyMind desde otra app (4.7). Es la `action` del
 * `share_target` del manifiesto (Android) y la puerta del Atajo «Guardar en OnMyMind» del iPhone.
 * Guarda directo en «En mente» y abre «En mente»; `/add` sigue siendo la captura con el texto.
 */
const searchSchema = z.object({
  title: z.string().optional().catch(undefined),
  text: z.string().optional().catch(undefined),
  url: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/share')({
  validateSearch: searchSchema,
  component: SharePage,
})

function SharePage() {
  useShareTarget(Route.useSearch())
  return null
}
