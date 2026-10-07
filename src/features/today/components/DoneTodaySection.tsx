import { useId, useState } from 'react'

import { DoneRow, FoldHeading, ListScope } from '@/features/items'

import { doneTodayLabel, type TodayDone } from '../today'
import { useUndoCompletion } from '../hooks/useUndoCompletion'
import { CompletionMeta } from './CompletionMeta'

/**
 * «2 hechas hoy» (decisión de Fran en 1.11; no está en el diseño): al final de Hoy, plegada, con
 * lo que vencía hasta hoy y se ha terminado hoy. Sigue el patrón de «Fuera de la cabeza»: filas
 * tachadas, y el checkbox la devuelve a pendiente. A la derecha, su lista.
 */
export function DoneTodaySection({ done }: { done: readonly TodayDone[] }) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const undo = useUndoCompletion()
  return (
    <section aria-label="Hechas hoy" className="flex flex-col">
      <FoldHeading
        open={open}
        controls={listId}
        onToggle={() => {
          setOpen((current) => !current)
        }}
      >
        {doneTodayLabel(done.length)}
      </FoldHeading>
      {open && (
        <ul id={listId} className="flex flex-col gap-0.5">
          {done.map(({ item, list, completion }) => (
            <ListScope key={completion?.id ?? item.id} list={list}>
              <DoneRow
                item={item}
                // Lo que se repite: cuándo vuelve y a qué hora se hizo; el check lo deshace (B12).
                meta={
                  completion && <CompletionMeta completion={completion} list={list} past={false} />
                }
                onToggle={
                  completion &&
                  (() => {
                    undo(completion)
                  })
                }
                aside={
                  <span className="max-w-[40%] shrink-0 truncate text-xs text-subtle-foreground">
                    {list.name}
                  </span>
                }
              />
            </ListScope>
          ))}
        </ul>
      )}
    </section>
  )
}
