import { ArchiveRestore } from 'lucide-react'
import { useState } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import { ListIcon, type ListIconSize } from '@/components/ListIcon'

import { archivedSheetSummary } from '../templates'
import type { List } from '../types'
import { useListActions } from './listActionsContext'

/**
 * Hoja de una lista archivada en móvil (diseño 04 Listas, L13): «Archivada el 12 sep · 2
 * pendientes · 84 €», qué pasa al desarchivarla, «Desarchivar», «Duplicar» (diseño 23, C6) y
 * «Borrar». La abren la sección de
 * archivadas de Inicio y los resultados de Buscar.
 */
export function ArchivedListSheet({
  list,
  onClose,
}: {
  list: List | undefined
  onClose: () => void
}) {
  const { unarchive, duplicate, confirmDelete } = useListActions()
  // Al cerrarse, la hoja se anima hacia abajo: sigue pintando la última lista hasta desaparecer.
  const [shown, setShown] = useState(list)
  if (list && list !== shown) setShown(list)

  return (
    <BottomSheet
      open={list !== undefined}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={shown ? `«${shown.name}» archivada` : 'Lista archivada'}
      className="gap-4"
    >
      {shown && (
        <>
          <div className="flex items-center gap-3">
            <DimmedIcon list={shown} />
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-extrabold tracking-[-0.02em]">
                {shown.name}
              </p>
              <p className="text-[13px] text-muted-foreground">{archivedSheetSummary(shown)}</p>
            </div>
          </div>
          <p className="text-sm leading-normal text-muted-foreground">
            Al desarchivarla vuelve a Inicio con todo lo que tenía.
          </p>
          <button
            type="button"
            onClick={() => {
              unarchive(shown)
              onClose()
            }}
            className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-primary font-display text-base font-bold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ArchiveRestore aria-hidden className="size-[18px]" strokeWidth={2} />
            Desarchivar
          </button>
          {/* Una archivada sirve de plantilla (4.4, diseño 23, C6): la copia sale en tus listas. */}
          <button
            type="button"
            onClick={() => {
              duplicate(shown)
              onClose()
            }}
            className="-mb-3 h-13 font-display text-[15px] font-bold text-foreground outline-none focus-visible:underline"
          >
            Duplicar
          </button>
          <button
            type="button"
            onClick={() => {
              confirmDelete(shown)
              onClose()
            }}
            className="h-13 font-display text-[15px] font-bold text-destructive outline-none focus-visible:underline"
          >
            Borrar
          </button>
        </>
      )}
    </BottomSheet>
  )
}

/**
 * Icono de una archivada: pierde el color de la lista (fondo `fill`, borde, y la inicial o el icono
 * en gris; el emoji, en escala de grises: diseño 28, L7).
 */
export function DimmedIcon({ list, size = 'sm' }: { list: List; size?: ListIconSize }) {
  return <ListIcon name={list.name} color={list.color} icon={list.icon} size={size} dimmed />
}
