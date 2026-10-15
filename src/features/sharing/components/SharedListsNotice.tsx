import { ListIcon } from '@/components/ListIcon'
import { useArchivedLists } from '@/features/lists/hooks/useArchivedLists'
import { useLists } from '@/features/lists/hooks/useLists'
import type { List } from '@/features/lists/types'
import { useCurrentUser } from '@/features/profile/hooks/useProfile'

import { deletionNote } from '../copy'
import { useSharedPeople } from '../hooks/useSharing'

/**
 * «Listas compartidas» en la confirmación de borrar la cuenta (diseño 20, P1 y P2): una a una, qué
 * les pasa. Sin listas compartidas no sale nada.
 */
export function SharedListsNotice() {
  const shared = useSharedPeople()
  const lists = useLists()
  const archived = useArchivedLists()
  const me = useCurrentUser()
  const all: List[] = [...(lists.data?.lists ?? []), ...(archived.data ?? [])]
  const rows = all.flatMap((list) => {
    const people = shared.data?.get(list.id) ?? []
    if (people.length < 2) return []
    const others = people.filter((person) => person.userId !== me.id)
    return [{ list, note: deletionNote(list.name, list.isOwner, others) }]
  })
  if (rows.length === 0) return null
  return (
    <section aria-label="Listas compartidas">
      <p className="px-1 pb-2 font-sans text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
        Listas compartidas
      </p>
      <ul className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-fill/60 p-3.5">
        {rows.map(({ list, note }) => (
          <li key={list.id} className="flex items-start gap-3">
            <ListIcon
              name={list.name}
              color={list.color}
              icon={list.icon}
              size="xs"
              className="size-7 text-xs"
            />
            <p className="text-[14px] leading-[1.45]">{note}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
