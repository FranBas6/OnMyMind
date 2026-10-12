import type { Item } from '../types'
import { NoteRow } from './NoteRow'
import { SublistRow } from './SublistRow'
import { TaskRow } from './TaskRow'

/**
 * Elige la fila por el tipo del ítem (diseño 12), no por el de su lista: la nota, la suya, con su
 * hoja y sin casilla (diseño 25, B1); tareas, compras y eventos, la fila de tarea con el control y
 * la meta de su tipo; la sublista, la suya, que se abre (diseño 12, S1).
 */
export function ItemRow({ item }: { item: Item }) {
  if (item.kind === 'note') return <NoteRow item={item} />
  if (item.kind === 'sublist') return <SublistRow item={item} />
  return <TaskRow item={item} />
}
