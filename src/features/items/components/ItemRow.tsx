import type { Item } from '../types'
import { InboxRow } from './InboxRow'
import { SublistRow } from './SublistRow'
import { TaskRow } from './TaskRow'

/**
 * Elige la fila por el tipo del ítem (diseño 12), no por el de su lista: lo de «En mente» (`note`)
 * enseña la antigüedad de cada captura y «Mover a…»; tareas, compras y eventos, la fila de tarea
 * con el control y la meta de su tipo; la sublista, la suya, que se abre (diseño 12, S1). Compras y eventos tendrán su propia fila en 2.1 y 2.3.
 */
export function ItemRow({ item }: { item: Item }) {
  if (item.kind === 'note') return <InboxRow item={item} />
  if (item.kind === 'sublist') return <SublistRow item={item} />
  return <TaskRow item={item} />
}
