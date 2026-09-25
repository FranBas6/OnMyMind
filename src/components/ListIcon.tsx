import { LIST_COLOR_BG, type ListColor } from '@/lib/listColors'
import { cn } from '@/lib/utils'

const SIZES = {
  // Tarjeta de Inicio (diseño, pantalla 2)
  sm: 'size-10 rounded-[13px] text-[17px]',
  // Cabecera del detalle de lista (pantalla 4)
  md: 'size-13 rounded-[17px] text-[22px]',
  // Cabecera del detalle en escritorio (D1)
  lg: 'size-14 rounded-[18px] text-2xl',
} as const

interface ListIconProps {
  name: string
  color: ListColor
  size?: keyof typeof SIZES
  className?: string
}

/**
 * Cuadrado del color de la lista con la inicial del nombre, siempre en blanco (06 §Colores de
 * lista). Elegir un icono en lugar de la inicial llegará con la edición de listas.
 */
export function ListIcon({ name, color, size = 'sm', className }: ListIconProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center font-display font-extrabold text-white',
        LIST_COLOR_BG[color],
        SIZES[size],
        className,
      )}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}
