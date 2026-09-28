import { useRouterState } from '@tanstack/react-router'
import { ArchiveRestore, ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

import { useArchivedLists } from '../hooks/useArchivedLists'
import { archivedCountLabel, archivedSheetSummary, archivedSummary } from '../templates'
import type { List } from '../types'
import { useListActions } from './listActionsContext'

/** Ancla de la sección: el sidebar de escritorio enlaza a `/#archivadas`. */
export const ARCHIVED_SECTION_ID = 'archivadas'

/**
 * Listas archivadas, al final de Inicio (diseño 04 Listas, L2, L12 y D9): una fila colapsada
 * «N listas archivadas» que se despliega en filas atenuadas con «Desarchivar». En móvil, tocar la
 * fila abre una hoja con «Desarchivar» y «Borrar» (L13). No aparece si no hay archivadas.
 */
export function ArchivedListsSection() {
  const archived = useArchivedLists()
  const hash = useRouterState({ select: (state) => state.location.hash })
  const [open, setOpen] = useState(hash === ARCHIVED_SECTION_ID)
  const [selected, setSelected] = useState<List | undefined>(undefined)
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const { unarchive, confirmDelete } = useListActions()
  const panelId = useId()

  const lists = archived.data ?? []
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
        <BottomSheet
          open={Boolean(selected)}
          onOpenChange={(next) => {
            if (!next) setSelected(undefined)
          }}
          title={selected ? `«${selected.name}» archivada` : 'Lista archivada'}
          className="gap-4"
        >
          {selected && (
            <>
              <div className="flex items-center gap-3">
                <DimmedIcon list={selected} />
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-extrabold tracking-[-0.02em]">
                    {selected.name}
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    {archivedSheetSummary(selected)}
                  </p>
                </div>
              </div>
              <p className="text-sm leading-normal text-muted-foreground">
                Al desarchivarla vuelve a Inicio con todo lo que tenía.
              </p>
              <button
                type="button"
                onClick={() => {
                  unarchive(selected)
                  setSelected(undefined)
                }}
                className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-primary font-display text-base font-bold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <ArchiveRestore aria-hidden className="size-[18px]" strokeWidth={2} />
                Desarchivar
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmDelete(selected)
                  setSelected(undefined)
                }}
                className="h-13 font-display text-[15px] font-bold text-destructive outline-none focus-visible:underline"
              >
                Borrar
              </button>
            </>
          )}
        </BottomSheet>
      )}
    </section>
  )
}

/** Icono de una archivada: pierde el color de la lista (fondo `fill`, borde e inicial en gris). */
function DimmedIcon({ list }: { list: List }) {
  return (
    <span
      aria-hidden
      className="grid size-10 shrink-0 place-items-center rounded-[13px] border border-border bg-fill font-display text-[17px] font-extrabold text-subtle-foreground"
    >
      {list.name.trim().charAt(0).toUpperCase()}
    </span>
  )
}
