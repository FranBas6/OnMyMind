import { Plus } from 'lucide-react'

interface FabProps {
  onClick: () => void
}

/**
 * Botón + de captura en móvil (pantalla 2 y diseño 07): círculo de 56 px en `primary`, a 20 px
 * del borde derecho y 16 px por encima de la barra. El aviso «Guardado en…» sale a su izquierda y
 * no lo tapa, así se puede capturar otra cosa sin esperar.
 */
export function Fab({ onClick }: FabProps) {
  return (
    <button
      type="button"
      aria-label="Captura rápida"
      onClick={onClick}
      className="fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-fab outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-offset-2"
    >
      <Plus aria-hidden className="size-[26px]" strokeWidth={2.4} />
    </button>
  )
}
