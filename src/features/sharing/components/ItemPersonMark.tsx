import type { Item } from '@/features/items/types'

import { personName } from '../copy'
import type { ListPerson } from '../schemas'
import { PersonInitial } from './PersonInitial'

/**
 * La inicial del otro al principio de la meta de una fila (diseño 20, M2): quien lo añadió o, en lo
 * terminado, quien lo completó. Al lector de pantalla se le dice con palabras.
 */
export function ItemPersonMark({
  person,
  item,
}: {
  person: ListPerson
  item: Pick<Item, 'completedAt'>
}) {
  const name = personName(person.displayName)
  return (
    <>
      <PersonInitial name={person.displayName} isOwner={person.isOwner} size="xs" />
      <span className="sr-only">
        {item.completedAt ? `Lo completó ${name}` : `Lo añadió ${name}`}
      </span>
    </>
  )
}
