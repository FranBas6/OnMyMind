import type { List } from '../types'
import { ListCard } from './ListCard'

/**
 * Rejilla de listas: dos columnas en móvil; en escritorio, tres cuando la columna de contenido
 * llega a 820 px (1280 px de ventana) y dos por debajo (1024 px), como en el diseño 03 Inicio.
 * Es una container query: mira el ancho de la columna, no el de la ventana. `grid-cols-*`
 * reparte con `minmax(0, 1fr)`, así que un nombre largo no ensancha su columna.
 */
export function ListGrid({ lists }: { lists: List[] }) {
  return (
    <div className="@container">
      <ul
        aria-label="Mis listas"
        className="grid grid-cols-2 gap-3 md:gap-4 @min-[820px]:grid-cols-3"
      >
        {lists.map((list) => (
          <li key={list.id} className="flex min-w-0">
            <ListCard list={list} />
          </li>
        ))}
      </ul>
    </div>
  )
}
