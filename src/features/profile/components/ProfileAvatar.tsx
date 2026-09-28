import { cn } from '@/lib/utils'

import { initialOf } from '../schemas'

const SIZES = {
  /** Pie del sidebar (diseño 09, D1). */
  sm: 'size-7 text-xs',
  /** Cabecera de Perfil en móvil. */
  md: 'size-14 text-[22px]',
  /** Cabecera de Perfil en escritorio. */
  lg: 'size-18 text-[28px]',
} as const

/** Avatar sin foto (diseño 09 Perfil): la inicial en blanco sobre el índigo de la marca. */
export function ProfileAvatar({
  name,
  size,
  className,
}: {
  name: string | null | undefined
  size: keyof typeof SIZES
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-primary font-display font-extrabold text-primary-foreground',
        SIZES[size],
        className,
      )}
    >
      {initialOf(name)}
    </span>
  )
}
