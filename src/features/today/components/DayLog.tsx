import { format } from 'date-fns'
import { useId, useState, type ReactNode } from 'react'

import {
  COMPACT_ROW,
  DoneRow,
  FoldHeading,
  ItemControl,
  ListScope,
  RowTitle,
  rowHighlight,
  SwipeableRow,
  useItemActions,
} from '@/features/items'
import type { List } from '@/features/lists'
import { LIST_COLOR_BG } from '@/lib/listColors'
import { cn } from '@/lib/utils'

import { dayLogLabel, type TodayDone, type TodayItem, type TodayNote } from '../today'
import { useUndoCompletion } from '../hooks/useUndoCompletion'
import { CompletionMeta } from './CompletionMeta'

type LogTense = 'today' | 'past'

/**
 * Lo que se ha quitado de la cabeza un día (Fran, 2026-10-22): «Hecho», lo terminado de cualquier
 * lista, y «Apuntado», las notas nuevas. En Hoy, al final y plegadas, con la cabecera de «Fuera de
 * la cabeza» y su número (antes «2 hechas hoy», 1.11); en un día pasado, abiertas y con la etiqueta
 * de sección (diseño 17, C4 y D6: «Hecho ese día»). Con `defaultOpen` (en Hoy sin nada pendiente,
 * Fran, 2026-10-30), abierta mientras no se pliegue a mano.
 */
function DayLogSection({
  kind,
  tense,
  count,
  defaultOpen = false,
  children,
}: {
  kind: 'done' | 'noted'
  tense: LogTense
  count: number
  defaultOpen?: boolean
  children: ReactNode
}) {
  // `null`: sin tocar, lo que toque (y cambia si se completa lo último pendiente).
  const [choice, setChoice] = useState<boolean | null>(null)
  const open = choice ?? defaultOpen
  const listId = useId()
  const label = dayLogLabel(kind, tense)

  if (tense === 'past') {
    return (
      <section aria-labelledby={listId} className="flex flex-col gap-1.5">
        <h2
          id={listId}
          className="px-1 font-sans text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase"
        >
          {label}
        </h2>
        <ul aria-label={label} className="flex flex-col gap-0.5">
          {children}
        </ul>
      </section>
    )
  }

  return (
    <section aria-label={label} className="flex flex-col">
      <FoldHeading
        open={open}
        controls={listId}
        onToggle={() => {
          setChoice(!open)
        }}
      >
        {label} <span className="font-semibold text-subtle-foreground">· {count}</span>
      </FoldHeading>
      {open && (
        <ul id={listId} className="flex flex-col gap-0.5">
          {children}
        </ul>
      )}
    </section>
  )
}

/**
 * Su lista y la hora («Develop · 14:05»): en Hoy, a la derecha de la fila; en un día pasado, debajo
 * del título con el cuadrado de su color.
 */
function ListAndTime({ list, at, tense }: { list: List; at: Date | null; tense: LogTense }) {
  const text = at ? `${list.name} · ${format(at, 'H:mm')}` : list.name
  if (tense === 'today') {
    return (
      <span className="max-w-[40%] shrink-0 truncate text-xs text-subtle-foreground">{text}</span>
    )
  }
  return (
    <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-subtle-foreground">
      <span
        aria-hidden
        className={cn('size-2 shrink-0 rounded-[3px]', LIST_COLOR_BG[list.color])}
      />
      <span className="truncate">{text}</span>
    </p>
  )
}

/**
 * «Hecho hoy» / «Hecho ese día»: filas tachadas, y el checkbox la devuelve a pendiente. Lo que se
 * repite lleva su línea (diseño 21, B12 y B13), que ya dice la hora; el resto, su lista y la hora
 * a la que se terminó. En un día pasado el control no se atenúa (diseño 17, C4).
 */
export function DoneSection({
  done,
  tense,
  defaultOpen = false,
}: {
  done: readonly TodayDone[]
  tense: LogTense
  /** En Hoy sin nada pendiente, abierta: es lo único que hay que ver (Fran, 2026-10-30). */
  defaultOpen?: boolean
}) {
  const undo = useUndoCompletion()
  return (
    <DayLogSection kind="done" tense={tense} count={done.length} defaultOpen={defaultOpen}>
      {done.map(({ item, list, completion }) => (
        <ListScope key={completion?.id ?? item.id} list={list}>
          <DoneRow
            item={item}
            muted={tense === 'today'}
            onToggle={
              completion &&
              (() => {
                undo(completion)
              })
            }
            meta={
              completion ? (
                <CompletionMeta completion={completion} list={list} past={tense === 'past'} />
              ) : (
                tense === 'past' && <ListAndTime list={list} at={item.completedAt} tense={tense} />
              )
            }
            aside={
              tense === 'today' && (
                <ListAndTime list={list} at={completion ? null : item.completedAt} tense={tense} />
              )
            }
          />
        </ListScope>
      ))}
    </DayLogSection>
  )
}

/** «Apuntado hoy» / «Apuntado ese día»: las notas nuevas, sin tachar, con su lista y la hora. */
export function NotedSection({ notes, tense }: { notes: readonly TodayNote[]; tense: LogTense }) {
  return (
    <DayLogSection kind="noted" tense={tense} count={notes.length}>
      {notes.map(({ item, list }) => (
        <ListScope key={item.id} list={list}>
          <NotedRow item={item} list={list} tense={tense} />
        </ListScope>
      ))}
    </DayLogSection>
  )
}

/**
 * Una nota apuntada: como las filas de lo hecho, pero sin tachar y con la hoja de la nota. Tocarla
 * abre su ficha; deslizarla, «Mover» y «Borrar», como en su lista.
 */
function NotedRow({ item, list, tense }: { item: TodayItem; list: List; tense: LogTense }) {
  const actions = useItemActions()
  return (
    <SwipeableRow
      item={item}
      surfaceClassName={cn(COMPACT_ROW, 'bg-background hover:bg-fill', rowHighlight(actions, item))}
    >
      <ItemControl item={item} onToggle={() => undefined} className="z-10" />
      <div className="min-w-0 flex-1">
        <RowTitle item={item} className="truncate text-[15px] font-normal" />
        {tense === 'past' && <ListAndTime list={list} at={item.createdAt} tense={tense} />}
      </div>
      {tense === 'today' && <ListAndTime list={list} at={item.createdAt} tense={tense} />}
    </SwipeableRow>
  )
}
