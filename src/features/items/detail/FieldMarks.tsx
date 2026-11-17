import { Fragment } from 'react'

import { cn } from '@/lib/utils'

/**
 * El trozo entendido marcado dentro del propio campo (diseño 21, A1): fondo índigo suave y texto
 * en `primary-strong`. Un campo de texto no puede pintar trozos de su texto, así que esto es una
 * copia exacta detrás de él, con la misma letra, el mismo hueco y el mismo scroll; el campo deja su
 * texto transparente (`markedFieldClass`) y se ve esta copia, con el cursor del campo encima.
 */
export function FieldMarks({
  text,
  ranges,
  scroll,
  multiline,
  className,
}: {
  text: string
  ranges: readonly { start: number; end: number }[]
  /** El scroll del campo, para que la copia se mueva con él. */
  scroll: { left: number; top: number }
  /** Un `textarea` parte las líneas; un `input`, no. */
  multiline: boolean
  /** La letra y el hueco del campo, iguales. */
  className?: string
}) {
  const parts: { text: string; marked: boolean }[] = []
  let cursor = 0
  for (const { start, end } of joinTouching(text, ranges)) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), marked: false })
    parts.push({ text: text.slice(start, end), marked: true })
    cursor = end
  }
  parts.push({ text: text.slice(cursor), marked: false })

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden text-foreground',
        multiline ? 'wrap-break-word whitespace-pre-wrap' : 'flex items-center whitespace-pre',
        className,
      )}
    >
      <div style={{ transform: `translate(${String(-scroll.left)}px, ${String(-scroll.top)}px)` }}>
        {parts.map((part, index) => (
          <Fragment key={index}>
            {part.marked ? (
              // El hueco de 3 px a cada lado sin mover el texto: lo de detrás tiene que coincidir.
              <mark className="-mx-[3px] rounded-md bg-brand-tint [box-decoration-break:clone] px-[3px] text-primary-strong">
                {part.text}
              </mark>
            ) : (
              part.text
            )}
          </Fragment>
        ))}
        {/* Un salto al final ocupa su línea, como en el campo. */}
        {multiline && '​'}
      </div>
    </div>
  )
}

/** «mañana» y «10h» son una marca, «mañana 10h», si entre ellos solo hay espacio (A1). */
function joinTouching(text: string, ranges: readonly { start: number; end: number }[]) {
  const joined: { start: number; end: number }[] = []
  for (const range of ranges) {
    const last = joined.at(-1)
    if (last && text.slice(last.end, range.start).trim() === '') last.end = range.end
    else joined.push({ ...range })
  }
  return joined
}

/** El campo con marcas: su texto transparente (se ve la copia) y el cursor índigo, como el diseño. */
export const markedFieldClass = 'text-transparent caret-primary'
