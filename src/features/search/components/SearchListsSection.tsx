import { Link } from '@tanstack/react-router'
import { Archive } from 'lucide-react'
import type { ReactNode } from 'react'

import { ListIcon } from '@/components/ListIcon'
import { InboxMark } from '@/features/capture'
import { DimmedIcon, listCounterLabel, type List } from '@/features/lists'
import { cn } from '@/lib/utils'

import type { ListMatch } from '../search'
import { Highlight } from './Highlight'

interface SearchListsSectionProps {
  matches: readonly ListMatch[]
  /** La lista marcada con las flechas en escritorio (Intro la abre). */
  activeId: string | undefined
  /** Una archivada no tiene detalle: en móvil abre su hoja; en escritorio, su sitio en Inicio. */
  onOpenArchived: (list: List) => void
}

/**
 * «Listas» arriba de los resultados (Buscar para todo, decisión de Fran en 1.12; no está en el
 * diseño): las que tienen lo buscado en el nombre, tres como mucho. La fila es la de «Todas las
 * listas» de la captura rápida (icono de 30 px, nombre y el tipo con su contador a la derecha)
 * sobre la tarjeta de los resultados. Tocarla abre la lista.
 */
export function SearchListsSection({ matches, activeId, onOpenArchived }: SearchListsSectionProps) {
  return (
    <section aria-label="Listas" className="flex flex-col gap-2">
      <h2 className="px-1 font-sans text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
        Listas
      </h2>
      <ul className="flex flex-col gap-2">
        {matches.map(({ list, ranges }) => {
          const content = (
            <ListRowContent list={list} name={<Highlight text={list.name} ranges={ranges} />} />
          )
          const className = cn(
            'flex min-h-14 w-full items-center gap-3 rounded-[18px] border border-border-soft bg-card px-3.5 py-2.5 text-left outline-none hover:border-border hover:shadow-card focus-visible:ring-[3px] focus-visible:ring-ring/50 md:rounded-2xl md:px-4',
            activeId === list.id && 'outline-2 -outline-offset-2 outline-primary outline-solid',
          )
          return (
            <li key={list.id}>
              {list.archivedAt ? (
                <button
                  type="button"
                  onClick={() => {
                    onOpenArchived(list)
                  }}
                  className={className}
                >
                  {content}
                </button>
              ) : (
                <Link to="/lists/$listId" params={{ listId: list.id }} className={className}>
                  {content}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ListRowContent({ list, name }: { list: List; name: ReactNode }) {
  const counter = listCounterLabel(list)
  return (
    <>
      {list.kind === 'inbox' ? (
        <span aria-hidden className="grid size-[30px] shrink-0 place-items-center">
          <InboxMark className="size-[18px]" />
        </span>
      ) : list.archivedAt ? (
        <DimmedIcon
          list={list}
          className="grid size-[30px] shrink-0 place-items-center rounded-[9px] border border-border bg-fill font-display text-[13px] font-extrabold text-subtle-foreground"
        />
      ) : (
        <ListIcon name={list.name} color={list.color} size="xs" />
      )}
      {/* En móvil el contador va debajo: a la derecha no dejaba sitio al nombre. */}
      <span className="flex min-w-0 flex-1 flex-col md:flex-row md:items-center md:gap-3">
        <span className="flex min-w-0 items-center gap-2 md:flex-1">
          <span className="truncate text-[15px] font-semibold">{name}</span>
          {list.archivedAt && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-[7px] bg-fill px-2 py-0.5 text-[11px] font-semibold text-subtle-foreground">
              <Archive aria-hidden className="size-3" strokeWidth={2.2} />
              Archivada
            </span>
          )}
        </span>
        <span className="text-xs text-subtle-foreground md:shrink-0">{counter}</span>
      </span>
    </>
  )
}
