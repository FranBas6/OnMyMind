import { rectSortingStrategy } from '@dnd-kit/sortable'
import { useState } from 'react'

import type { List } from '../types'
import { LiftedListCard, ListCard } from './ListCard'
import { ListsDnd } from './ListsDnd'
import { NewListCard } from './NewListEntries'

/**
 * Rejilla de listas: dos columnas en móvil; en escritorio, tres cuando la columna de contenido
 * llega a 820 px (1280 px de ventana) y dos por debajo (1024 px), como en el diseño 03 Inicio.
 * Es una container query: mira el ancho de la columna, no el de la ventana. `grid-cols-*`
 * reparte con `minmax(0, 1fr)`, así que un nombre largo no ensancha su columna. Las tarjetas se
 * ordenan arrastrando (2.9, diseño 14, I1 y D6); «En mente» va fijada encima, fuera de la rejilla.
 */
export function ListGrid({
  lists,
  label = 'Mis listas',
  canCreate = true,
}: {
  lists: List[]
  label?: string
  /** La tarjeta punteada de crear una lista, en el móvil; en «Listas ocultas», no. */
  canCreate?: boolean
}) {
  const [menuListId, setMenuListId] = useState<string | null>(null)
  return (
    <div className="@container">
      <ListsDnd
        lists={lists}
        strategy={rectSortingStrategy}
        renderLifted={(list) => <LiftedListCard list={list} />}
        // Mantener pulsada una tarjeta y soltarla sin moverla abre su menú, como antes.
        onPressRelease={(list) => {
          setMenuListId(list.id)
        }}
      >
        <ul aria-label={label} className="grid grid-cols-2 gap-3 md:gap-4 @min-[820px]:grid-cols-3">
          {lists.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              menuOpen={menuListId === list.id}
              onMenuOpenChange={(open) => {
                setMenuListId(open ? list.id : null)
              }}
            />
          ))}
          {/* En móvil, crear una lista desde el final de la rejilla (diseño 04 Listas). */}
          {canCreate && (
            <li className="flex min-w-0 md:hidden">
              <NewListCard />
            </li>
          )}
        </ul>
      </ListsDnd>
    </div>
  )
}
