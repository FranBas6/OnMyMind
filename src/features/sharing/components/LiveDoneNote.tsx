import type { Item } from '@/features/items/types'

import { completedNote } from '../copy'
import type { ListPerson } from '../schemas'
import { PersonInitial } from './PersonInitial'

/**
 * La meta de lo que otra persona acaba de terminar, mientras se queda en su sitio (diseño 20, M8):
 * su inicial y «Fran lo ha comprado», en lugar de la meta de siempre.
 */
export function LiveDoneNote({ person, item }: { person: ListPerson; item: Pick<Item, 'status'> }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <PersonInitial name={person.displayName} isOwner={person.isOwner} size="xs" />
      <span className="truncate text-xs font-semibold text-muted-foreground md:text-[13px]">
        {completedNote(person.displayName, item.status)}
      </span>
    </span>
  )
}
