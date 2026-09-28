import { Search } from 'lucide-react'

/**
 * Antes de escribir (diseño 08, B1 y D1): qué busca y que no importan acentos ni mayúsculas. Sin
 * historial ni sugerencias. En escritorio, las dos frases en un párrafo.
 */
export function SearchHint({ isDesktop }: { isDesktop: boolean }) {
  const what =
    'Busca en el título y las notas de todo lo que tienes, también en lo hecho y en las listas archivadas.'
  const accents = 'Sin acentos ni mayúsculas: «cafe» encuentra «café».'
  if (isDesktop) {
    return (
      <p className="max-w-[520px] px-1 text-[15px] leading-normal text-muted-foreground">
        {what} {accents}
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-3.5 px-2 pt-2.5">
      <p className="text-[15px] leading-normal text-muted-foreground">{what}</p>
      <p className="text-[13px] leading-normal text-subtle-foreground">{accents}</p>
    </div>
  )
}

interface NoResultsProps {
  query: string
  /** Con un filtro puesto y resultados en el otro: «Nada pendiente. Hay 4 en Hechas.». */
  otherNote: string | null
  onShowAll: () => void
}

/**
 * Sin resultados (diseño 08, B5 y B6): la lupa en `brand-tint`, «No hay nada con «xyz».» y una
 * línea que ayuda; si el otro filtro sí tiene, lo dice y ofrece «Ver todo».
 */
export function NoResults({ query, otherNote, onShowAll }: NoResultsProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-16 text-center">
      <div className="grid size-18 place-items-center rounded-[22px] bg-brand-tint">
        <Search aria-hidden className="size-7 text-primary" strokeWidth={2.4} />
      </div>
      <p className="mt-1 font-display text-xl leading-[1.25] font-extrabold tracking-[-0.02em] wrap-anywhere">
        No hay nada con «{query.trim()}».
      </p>
      <p className="-mt-1 max-w-[300px] text-sm leading-normal text-muted-foreground">
        {otherNote ??
          'Busca también en las notas y en lo que ya está hecho. Prueba con otra palabra.'}
      </p>
      {otherNote && (
        <button
          type="button"
          onClick={onShowAll}
          className="mt-1 h-10 rounded-xl bg-brand-tint px-4 font-display text-sm font-bold text-primary-strong outline-none hover:bg-brand-tint/70 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Ver todo
        </button>
      )}
    </div>
  )
}
