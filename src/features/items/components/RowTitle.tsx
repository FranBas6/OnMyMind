import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { notesExcerpt } from '../notes'
import type { Item } from '../types'
import { useItemActions } from './itemActionsContext'

/**
 * El título de una fila es el botón que abre el detalle, y su pseudoelemento cubre la fila
 * entera: tocar en cualquier sitio abre el detalle, salvo en el checkbox y en los botones, que
 * van por encima (`z-10`). Así hay un solo elemento enfocable por fila para abrirla.
 */
export function RowTitle({
  item,
  className,
  children,
}: {
  item: Item
  className?: string
  /** Otro contenido en vez del título tal cual (Buscar lo pinta con el término resaltado). */
  children?: ReactNode
}) {
  const { openDetail } = useItemActions()
  return (
    <button
      type="button"
      onClick={() => {
        openDetail(item)
      }}
      className={cn(
        'block w-full text-left text-base leading-[1.3] font-medium wrap-break-word outline-none after:absolute after:inset-0 after:rounded-[18px] after:content-[""] focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50 md:after:rounded-2xl',
        className,
      )}
    >
      {children ?? item.title}
    </button>
  )
}

/**
 * El principio de las notas bajo el título (Fran, 2026-10-11): una línea en `muted` de 13 px,
 * cortada con «…», como el fragmento de Buscar. En las filas de una lista, de una sublista, de
 * «En mente» y de Buscar; Hoy y la Agenda siguen compactas. Sin notas no ocupa nada.
 */
export function RowNotes({ notes, className }: { notes: string | null; className?: string }) {
  const excerpt = notesExcerpt(notes)
  if (!excerpt) return null
  return (
    <p
      className={cn(
        'mt-1 truncate text-[13px] leading-[1.4] text-muted-foreground md:mt-[3px]',
        className,
      )}
    >
      <span className="sr-only">Notas: </span>
      {excerpt}
    </p>
  )
}
