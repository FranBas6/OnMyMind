import { LIST_COLOR_BG, LIST_COLOR_EMOJI, type ListColor } from '@/lib/listColors'
import { parseListIcon } from '@/lib/listIcons'
import { cn } from '@/lib/utils'

/**
 * Los tamaños del cuadrado (diseño 28, R): el radio, un tercio del lado (30 % por debajo de 24 px);
 * la inicial, en su tamaño de siempre; el icono, al 50 % del lado (al 64 % en los pequeños), con
 * trazo 2,4 hasta 30 px y 2 por encima; el emoji, algo más que el icono.
 */
const SIZES = {
  // Chips de la captura y secciones de Hoy y Buscar (diseño 28, L5 y L6)
  chip: { box: 'size-5 rounded-[6px] text-[10px]', glyph: 13, stroke: 2.4, emoji: 'text-[11px]' },
  // El sidebar de escritorio (diseño 28, E3)
  side: {
    box: 'size-[22px] rounded-[7px] text-[11px]',
    glyph: 14,
    stroke: 2.4,
    emoji: 'text-[12px]',
  },
  // Destino en el popover «Mover a…» de escritorio (diseño 06, D6)
  xs: {
    box: 'size-[30px] rounded-[9px] text-[13px]',
    glyph: 15,
    stroke: 2.4,
    emoji: 'text-[16px]',
  },
  // Destino en la hoja «Mover a…» (diseño 05 E2 y 06 T6)
  row: { box: 'size-9 rounded-[10px] text-[15px]', glyph: 18, stroke: 2, emoji: 'text-[19px]' },
  // Tarjeta de Inicio (diseño, pantalla 2)
  sm: { box: 'size-10 rounded-[13px] text-[17px]', glyph: 20, stroke: 2, emoji: 'text-[21px]' },
  // Cabecera del detalle de lista (pantalla 4)
  md: { box: 'size-13 rounded-[17px] text-[22px]', glyph: 26, stroke: 2, emoji: 'text-[27px]' },
  // Cabecera del detalle en escritorio (D1)
  lg: { box: 'size-14 rounded-[18px] text-2xl', glyph: 28, stroke: 2, emoji: 'text-[29px]' },
  // El formulario de lista (diseño 04 y 28, I1)
  form: { box: 'size-16 rounded-[20px] text-[26px]', glyph: 32, stroke: 2, emoji: 'text-[33px]' },
  // La lista a la que te invitan (diseño 20, J2)
  xl: { box: 'size-22 rounded-[26px] text-[40px]', glyph: 44, stroke: 2, emoji: 'text-[46px]' },
} as const

export type ListIconSize = keyof typeof SIZES

interface ListIconProps {
  name: string
  color: ListColor
  /** `lists.icon`: `lucide:<nombre>`, `emoji:<emoji>` o `null` (la inicial). */
  icon?: string | null | undefined
  size?: ListIconSize
  /**
   * Archivada (diseño 28, L7): sin el color de la lista, el cuadrado gris con la inicial o el icono
   * en gris y el emoji en escala de grises.
   */
  dimmed?: boolean
  className?: string
}

/**
 * El cuadrado de una lista (06 §Colores de lista y diseño 28): su color con la inicial o el icono
 * en blanco, o el emoji sobre el color al 18 %.
 */
export function ListIcon({
  name,
  color,
  icon,
  size = 'sm',
  dimmed = false,
  className,
}: ListIconProps) {
  const glyph = parseListIcon(icon)
  const config = SIZES[size]
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center font-display font-extrabold',
        config.box,
        dimmed
          ? 'border border-border bg-fill text-subtle-foreground'
          : glyph?.kind === 'emoji'
            ? LIST_COLOR_EMOJI[color]
            : [LIST_COLOR_BG[color], 'text-white'],
        className,
      )}
    >
      {glyph?.kind === 'icon' ? (
        <glyph.choice.icon size={config.glyph} strokeWidth={config.stroke} />
      ) : glyph?.kind === 'emoji' ? (
        <span
          className={cn('leading-none font-normal', config.emoji, dimmed && 'opacity-60 grayscale')}
        >
          {glyph.emoji}
        </span>
      ) : (
        name.trim().charAt(0).toUpperCase() || '·'
      )}
    </span>
  )
}
