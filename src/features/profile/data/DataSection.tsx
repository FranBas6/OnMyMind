import { ChevronRight, Download } from 'lucide-react'

import { useOnline } from '@/hooks/useOnline'
import { cn } from '@/lib/utils'

/**
 * «Datos» (diseño 18, P6 y D5): «Exportar mis datos», que abre la hoja de exportar. Sin conexión,
 * en gris y «Necesita conexión» (P11). «Importar» es de la fase 3.
 */
export function DataSection({ onExport }: { onExport: () => void }) {
  const online = useOnline()
  return (
    <div className="overflow-hidden rounded-2xl border border-border-soft bg-card">
      <button
        type="button"
        disabled={!online}
        onClick={onExport}
        className={cn(
          'flex h-13 w-full items-center gap-3 px-4 text-left text-[15px] font-medium outline-none hover:bg-fill focus-visible:bg-fill disabled:hover:bg-transparent',
          !online && 'text-muted-foreground',
        )}
      >
        <Download aria-hidden className="size-[18px] shrink-0 text-muted-foreground" />
        <span className="flex-1">Exportar mis datos</span>
        {online ? (
          <ChevronRight aria-hidden className="size-4 text-subtle-foreground" />
        ) : (
          <span className="text-[14px] font-normal text-muted-foreground">Necesita conexión</span>
        )}
      </button>
    </div>
  )
}
