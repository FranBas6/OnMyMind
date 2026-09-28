import type { Item } from '../types'
import { InboxRow } from './InboxRow'
import { useItemActions } from './itemActionsContext'
import { TaskRow } from './TaskRow'

/**
 * Elige la fila según el tipo de lista: «En mente» enseña la antigüedad de cada captura y
 * «Mover a…»; el resto, la fila de tarea (con sus chips solo en Tareas). Compras, Eventos y
 * Personalizadas tendrán su propia fila cuando lleguen sus pantallas.
 */
export function ItemRow({ item }: { item: Item }) {
  const { list } = useItemActions()
  return list.kind === 'inbox' ? <InboxRow item={item} /> : <TaskRow item={item} />
}
