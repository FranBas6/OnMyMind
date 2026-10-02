import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { z } from 'zod'

import { useCapture } from '@/features/capture'

/**
 * `/add?text=…&url=…` abre la captura con el contenido ya escrito y deja la URL en `/` (02
 * §Atajos en iOS): es la puerta del Atajo «Guardar en OnMyMind» de la hoja de compartir de iOS.
 * El enlace va detrás del texto y la captura entra en modo enlace (2.3): con solo `url`, el título
 * será el de la página; con `text`, ese texto.
 */
const searchSchema = z.object({
  text: z.string().optional().catch(undefined),
  url: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/add')({
  validateSearch: searchSchema,
  component: AddPage,
})

function AddPage() {
  const { text, url } = Route.useSearch()
  const capture = useCapture()
  const navigate = useNavigate()

  useEffect(() => {
    const prefill = [text, url].filter(Boolean).join(' ')
    capture.open({ text: prefill })
    void navigate({ to: '/', replace: true })
    // Solo al llegar: después, la captura ya es de quien la usa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
