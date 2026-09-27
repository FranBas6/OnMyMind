import { InboxRow } from './InboxRow'
import { TaskRow, type RowProps } from './TaskRow'

/**
 * Elige la fila según el tipo de lista: «En mente» enseña la antigüedad de cada captura; el
 * resto, la fila de tarea (con sus chips solo en Tareas). Compras, Eventos y Personalizadas
 * tendrán su propia fila cuando lleguen sus pantallas.
 */
export function ItemRow(props: RowProps) {
  return props.kind === 'inbox' ? <InboxRow {...props} /> : <TaskRow {...props} />
}
