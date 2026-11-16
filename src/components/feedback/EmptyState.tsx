import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  /** Hasta dos acciones (06 §Componentes). */
  children?: ReactNode
}

/**
 * Estado vacío. En móvil, el patrón de la pantalla 15 (cuadrado de 96 px con radio 32); en
 * escritorio, el de 03 Inicio D6 (64 px con radio 22, más aire arriba y texto a 360 px).
 */
export function EmptyState({ icon: Icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-10 text-center md:gap-3 md:pt-16 md:pb-6">
      <div className="grid size-24 place-items-center rounded-[32px] bg-brand-tint md:size-16 md:rounded-[22px]">
        <Icon aria-hidden className="size-12 text-primary md:size-[30px]" strokeWidth={1.75} />
      </div>
      <p className="font-display text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em]">
        {title}
      </p>
      <p className="max-w-[360px] text-[15px] leading-normal text-muted-foreground">
        {description}
      </p>
      {children && <div className="mt-2 flex w-full flex-col items-center gap-2">{children}</div>}
    </div>
  )
}
