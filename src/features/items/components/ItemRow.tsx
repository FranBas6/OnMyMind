import type { Item } from '../types'
import { InboxRow } from './InboxRow'
import { TaskRow } from './TaskRow'

/**
 * Elige la fila por el tipo del ítem (diseño 12), no por el de su lista: lo de «En mente» (`note`)
 * enseña la antigüedad de cada captura y «Mover a…»; tareas, compras y eventos, la fila de tarea
 * con el control y la meta de su tipo. Compras y eventos tendrán su propia fila en 2.1 y 2.3.
 */
export function ItemRow({ item }: { item: Item }) {
  return item.kind === 'note' ? <InboxRow item={item} /> : <TaskRow item={item} />
}
