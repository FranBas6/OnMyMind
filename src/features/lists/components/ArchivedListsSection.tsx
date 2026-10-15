import { useRouterState } from '@tanstack/react-router'
import { ArchiveRestore, ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'

import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

import { useArchivedLists } from '../hooks/useArchivedLists'
import { archivedCountLabel, archivedSummary } from '../templates'
import type { List } from '../types'
import { ArchivedListSheet, DimmedIcon } from './ArchivedListSheet'
import { useListActions } from './listActionsContext'

/** Ancla de la sección: el sidebar de escritorio enlaza a `/#archivadas`. */
export const ARCHIVED_SECTION_ID = 'archivadas'

/**
 * Listas archivadas, al final de Inicio (diseño 04 Listas, L2, L12 y D9): una fila colapsada
 * «N listas archivadas» que se despliega en filas atenuadas con «Desarchivar». En móvil, tocar la
 * fila abre una hoja con «Desarchivar» y «Borrar» (L13). No aparece si no hay archivadas. Con
 * `lists`, esas en vez de las de Inicio: las ocultas archivadas, en su pantalla.
 */
export function ArchivedListsSection({ lists: given }: { lists?: List[] } = {}) {
  const archived = useArchivedLists()
  const hash = useRouterState({ select: (state) => state.location.hash })
  const [open, setOpen] = useState(hash === ARCHIVED_SECTION_ID)
  const [selected, setSelected] = useState<List | undefined>(undefined)
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const { unarchive, duplicate } = useListActions()
  const panelId = useId()

  // En «Listas ocultas» (5.8), las archivadas de allí, que no salen en Inicio.
  const lists = given ?? archived.data ?? []
  if (lists.length === 0) return null

  return (
    <section
      id={ARCHIVED_SECTION_ID}
      aria-label="Listas archivadas"
      className="flex flex-col gap-0.5 border-t border-border pt-2"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => !current)
        }}
        className="flex h-11 items-center gap-2 px-1 font-display text-sm font-bold text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ChevronDown
          aria-hidden
          className={cn('size-4 transition-transform', open && 'rotate-180')}
          strokeWidth={2.2}
        />
        {archivedCountLabel(lists.length)}
      </button>

      {open && (
        <ul id={panelId} className="flex flex-col gap-0.5">
          {lists.map((list) => (
            <li
              key={list.id}
              className="group flex min-h-16 items-center gap-3.5 rounded-2xl px-3 py-2.5 md:hover:bg-fill"
            >
              <button
                type="button"
                disabled={isDesktop}
                onClick={() => {
                  setSelected(list)
                }}
                className="flex min-w-0 flex-1 items-center gap-3.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default"
              >
                <DimmedIcon list={list} />
                <span className="min-w-0">
                  <span className="block font-display text-[15px] leading-[1.2] font-bold text-muted-foreground">
                    {list.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-subtle-foreground">
                    {archivedSummary(list)}
                  </span>
                </span>
              </button>
              {/* En escritorio no hay hoja: «Duplicar…» va junto a «Desarchivar» (diseño 23, C6). */}
              {isDesktop && (
                <button
                  type="button"
                  onClick={() => {
                    duplicate(list)
                  }}
                  className="flex h-9 shrink-0 items-center rounded-[11px] px-3 text-[13px] font-semibold text-muted-foreground outline-none hover:bg-card hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  Duplicar…
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  unarchive(list)
                }}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-[11px] px-3 text-[13px] font-semibold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:group-hover:bg-primary md:group-hover:px-3.5 md:group-hover:font-display md:group-hover:font-bold md:group-hover:text-primary-foreground"
              >
                <ArchiveRestore
                  aria-hidden
                  className="hidden size-[18px] md:group-hover:block"
                  strokeWidth={2}
                />
                Desarchivar
              </button>
            </li>
          ))}
        </ul>
      )}

      {!isDesktop && (
        <ArchivedListSheet
          list={selected}
          onClose={() => {
            setSelected(undefined)
          }}
        />
      )}
    </section>
  )
}
