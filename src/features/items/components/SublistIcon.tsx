import { LIST_COLOR_SUBLIST, LIST_COLOR_TEXT, type ListColor } from '@/lib/listColors'
import { cn } from '@/lib/utils'

import { SublistGlyph } from '@/components/SublistGlyph'

const SIZES = {
  // Fila (S1): 24 px, radio 7, líneas de 12.
  row: { box: 'size-6 rounded-[7px]', glyph: 'size-3' },
  // Destino en un popover (D6): 30 px, como el icono de lista `xs`.
  xs: { box: 'size-[30px] rounded-[9px]', glyph: 'size-3.5' },
  // Destino en una hoja (A3, A5): 36 px, radio 11.
  md: { box: 'size-9 rounded-[11px]', glyph: 'size-4' },
  // Cabecera de su pantalla (S2): como el icono de lista, 52 px (56 en escritorio).
  header: { box: 'size-[52px] rounded-[17px] md:size-14 md:rounded-[18px]', glyph: 'size-6' },
  // Vacía (S3): 88 px.
  empty: { box: 'size-22 rounded-[28px]', glyph: 'size-10' },
} as const

interface SublistIconProps {
  /** El color de su lista: la sublista lo hereda (ADR-010). Sin él, en gris. */
  color?: ListColor
  size?: keyof typeof SIZES
  /** Pausada: fondo más tenue y líneas en gris; hecha, solo las líneas en gris (S1). */
  state?: 'active' | 'paused' | 'done'
  className?: string
}

/** El icono de una sublista: su cuadrado en el color de la lista con las tres líneas. */
export function SublistIcon({
  color,
  size = 'row',
  state = 'active',
  className,
}: SublistIconProps) {
  const { box, glyph } = SIZES[size]
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center',
        box,
        color ? LIST_COLOR_SUBLIST[color][state === 'paused' ? 'paused' : 'active'] : 'bg-fill',
        className,
      )}
    >
      <SublistGlyph
        className={cn(
          glyph,
          color && state === 'active' ? LIST_COLOR_TEXT[color] : 'text-subtle-foreground',
        )}
        strokeWidth={3}
      />
    </span>
  )
}
