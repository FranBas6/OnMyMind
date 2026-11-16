import { createPortal } from 'react-dom'

/**
 * La barra de abajo mientras se ordena con el teclado (diseño 14, D4): qué se mueve, en qué sitio
 * va y las teclas. Solo es para la vista: lo que se mueve lo anuncia dnd-kit al lector de pantalla.
 */
export function KeyboardDragHint({
  label,
  position,
  total,
}: {
  label: string
  position: number
  total: number
}) {
  return createPortal(
    <div
      aria-hidden
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-toast px-[18px] py-3 text-[13px] whitespace-nowrap text-toast-foreground shadow-toast"
    >
      <span className="max-w-[220px] truncate font-semibold">{label}</span>
      <span className="text-toast-foreground/70">
        · {position} de {total}
      </span>
      <span className="h-4 w-px bg-toast-foreground/25" />
      <Key>↑</Key>
      <Key>↓</Key>
      <span>mover</span>
      <Key>Espacio</Key>
      <span>soltar</span>
      <Key>Esc</Key>
      <span>cancelar</span>
    </div>,
    document.body,
  )
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="rounded-md bg-toast-foreground/15 px-1.5 py-0.5 font-sans text-[11px] font-semibold">
      {children}
    </kbd>
  )
}
