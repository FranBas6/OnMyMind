import type { LucideIcon } from 'lucide-react'

export interface UndoToastProps {
  /** Sin él, solo el texto (el aviso de versión nueva en móvil, diseño 10). */
  icon?: LucideIcon
  message: string
  /** Por defecto, «Deshacer». */
  actionLabel?: string
  /** Sin él, el aviso solo informa («Contraseña cambiada»). */
  onUndo?: () => void
}

/**
 * Aviso de 48 px (radio 14, `toast`) tras una acción que se puede deshacer: archivar una lista,
 * borrar un ítem. Abajo, sobre la barra en móvil y a 32 px en escritorio. Sin `onUndo`, el mismo
 * aviso sin «Deshacer».
 */
export function UndoToast({
  icon: Icon,
  message,
  actionLabel = 'Deshacer',
  onUndo,
}: UndoToastProps) {
  return (
    <div className="flex h-12 w-full items-center gap-[18px] rounded-[14px] bg-toast px-[18px] text-sm font-medium whitespace-nowrap text-toast-foreground shadow-toast md:min-w-[360px]">
      {Icon && <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={2} />}
      <span className="truncate">{message}</span>
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          className="ml-auto font-bold text-toast-action outline-none hover:underline focus-visible:underline"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
