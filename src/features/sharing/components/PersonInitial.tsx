import { initialOf } from '@/features/profile/schemas'
import { cn } from '@/lib/utils'

const SIZES = {
  /** En la meta de una fila (M2). */
  xs: 'size-[18px] text-[10px]',
  /** En la esquina del icono de la lista, en la invitación (J2), con borde del fondo. */
  corner: 'size-8 text-[15px] ring-[3px] ring-background',
  /** Filas de «Quién está» (S2, M4). */
  md: 'size-9 text-[15px]',
  /** Confirmar quitar a alguien (S8). */
  lg: 'size-11 text-lg',
} as const

/**
 * La inicial de una persona en un círculo (diseño 20): quien creó la lista en índigo y quien
 * entra en verde azulado, suaves y distintos de los colores de lista para no confundirlos.
 */
export function PersonInitial({
  name,
  isOwner,
  size = 'md',
  className,
}: {
  name: string | null
  isOwner: boolean
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-display font-extrabold',
        isOwner ? 'bg-person-owner-bg text-person-owner' : 'bg-person-member-bg text-person-member',
        SIZES[size],
        className,
      )}
    >
      {initialOf(name)}
    </span>
  )
}
