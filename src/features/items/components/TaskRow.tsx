import { ChevronRight, Repeat } from 'lucide-react'

// Por sus rutas y no por el índice: `reminders` usa piezas de `items`.
import { ReminderBell } from '@/features/reminders/components/ReminderBell'
import { useItemReminder } from '@/features/reminders/hooks/useReminders'
import { showsBell } from '@/features/reminders/reminders'
import { formatDueDate } from '@/lib/date'
import { cn } from '@/lib/utils'
import { ItemPersonMark } from '@/features/sharing/components/ItemPersonMark'
import { LiveDoneNote } from '@/features/sharing/components/LiveDoneNote'
import { useLiveRow } from '@/features/sharing/hooks/useLiveRow'

import { eventTime, eventWhen, occurrence, shortDay } from '../events'
import { kindMark } from '../kind'
import { recurrenceLabel } from '../recurrence'
import { useRepeatMark } from '../repeatMarks'
import type { Item } from '../types'
import { useOptionMark } from './choiceContext'
import { DateChip } from './DateChip'
import { ItemControl } from './ItemControl'
import { rowHighlight, useItemActions } from './itemActionsContext'
import { ItemRowDotsMenu } from './ItemRowMenu'
import { itemPrice } from '../prices'
import { PriorityChip } from './PriorityChip'
import { hasThumb } from '../photos'
import { LinkMeta, RowPrice, RowThumb } from './RowMedia'
import { OptionAside } from './OptionAside'
import { RowNotes, RowTitle } from './RowTitle'
import { SwipeableRow } from './SwipeableRow'

const META = 'text-xs font-semibold whitespace-nowrap text-muted-foreground md:text-[13px]'

/** La rejilla de escritorio: con miniatura, una columna de 44 px; con precios, la de 96 px. */
const GRID = {
  plain: 'md:grid-cols-[24px_minmax(0,1fr)_auto_auto_32px]',
  thumb: 'md:grid-cols-[24px_44px_minmax(0,1fr)_auto_auto_32px]',
  prices: 'md:grid-cols-[24px_minmax(0,1fr)_auto_auto_96px_32px]',
  thumbPrices: 'md:grid-cols-[24px_44px_minmax(0,1fr)_auto_auto_96px_32px]',
} as const

/**
 * Fila de tarea (pantalla 4 v1 y D1), que también es la de las compras y los eventos hasta sus
 * pantallas (2.1 y 2.3). El tipo es del ítem, no de la lista (diseño 12): cambia el control de la
 * izquierda (`ItemControl`) y lo de debajo del título. La tarea lleva sus chips de prioridad y
 * fecha; el evento, su día y su hora; y si no hay nada que enseñar y el ítem no es del tipo por
 * defecto de su lista, el nombre del tipo («Compra»). En escritorio, una rejilla con eso en sus
 * columnas a la derecha, alineadas entre filas, y el ··· del menú al final (diseño 06, D8). Con
 * foto, su miniatura tras el control; con enlace, su dominio en la meta (diseño 15). Una compra con
 * precio lo lleva a la derecha, y en escritorio en la última columna, que reservan todas las filas
 * de una lista con precios (diseño 16, A1 y D2). Tocar
 * la fila abre el detalle; mantenerla pulsada, el menú; deslizarla, sus acciones (`SwipeableRow`).
 */
export function TaskRow({ item }: { item: Item }) {
  const actions = useItemActions()
  const { list, isDesktop } = actions
  // En una lista compartida, la inicial de quien lo añadió si no fuiste tú (diseño 20, M2); y en
  // directo, lo que acaba de añadir (M7) o de terminar (M8) la otra persona.
  const { person, arrived, done: liveDone } = useLiveRow(item)
  // Lo que otro acaba de terminar dice solo eso, con su inicial, hasta que baja (M8).
  const quiet = liveDone
  const task = item.kind === 'task'
  const priority = task ? item.priority : null
  const dueAt = task ? item.dueAt : null
  const event = item.kind === 'event'
  // El día y la hora (diseño 17, E8 y D3): en móvil en una línea, en escritorio en dos.
  const eventDate = event ? eventWhen(item) : null
  const at = event ? occurrence(item) : null
  // Lo que se repite, también una tarea (diseño 21, B7): la regla corta, cortada con puntos si no
  // cabe.
  const repeatText = quiet ? null : recurrenceLabel(item.recurrence, true)
  const repeat = repeatText && (
    <span className={cn(META, 'flex min-w-0 items-center gap-1')}>
      <Repeat aria-hidden className="size-3 shrink-0" strokeWidth={2.4} />
      <span className="truncate">{repeatText}</span>
    </span>
  )
  // Recién completada una que se repite (B9): un segundo marcada y tachada, con la fecha cambiando
  // delante de ti; después, el borde índigo apagándose (B10).
  const repeatMark = useRepeatMark(item.id)
  const justDone = repeatMark?.phase === 'done' ? repeatMark : null
  // Una opción de una sublista «para elegir una» (5.1, diseño 24): «Elegida», «Más barata»,
  // «+50,99 €»… a la derecha.
  const option = useOptionMark(item)
  const mark =
    priority === null && dueAt === null && eventDate === null
      ? kindMark(item.kind, list.kind)
      : null
  const first = quiet ? null : priority ? (
    <PriorityChip priority={priority} />
  ) : mark ? (
    <span className={META}>{mark}</span>
  ) : null
  const second = quiet ? null : justDone && dueAt ? (
    <span className={cn(META, 'flex items-center gap-1')}>
      <span className="line-through">{formatDueDate(justDone.from).text}</span>
      <ChevronRight aria-hidden className="size-3" strokeWidth={2.4} />
      {formatDueDate(dueAt).text}
    </span>
  ) : dueAt ? (
    <DateChip date={dueAt} />
  ) : eventDate ? (
    <span className={cn(META, 'md:min-w-16 md:text-right')}>
      <span className="sr-only">Fecha: </span>
      <span className="md:hidden">{eventDate}</span>
      {at && (
        <span className="hidden md:flex md:flex-col md:leading-tight">
          <span>{shortDay(at)}</span>
          <span className="text-xs font-medium">{eventTime(item) ?? 'Todo el día'}</span>
        </span>
      )}
    </span>
  ) : null
  // La campana del aviso (diseño 18, R13): junto a la fecha; sin fecha, con su momento.
  const reminder = useItemReminder(item.id)
  const bell =
    !quiet && showsBell(reminder, item) ? <ReminderBell item={item} className={META} /> : null
  const thumb = hasThumb(item)
  const link = !quiet && item.url ? <LinkMeta url={item.url} item={item} className={META} /> : null
  const author =
    person &&
    (liveDone ? (
      <LiveDoneNote person={person} item={item} />
    ) : (
      <span className="flex shrink-0 items-center">
        <ItemPersonMark person={person} item={item} />
      </span>
    ))
  const dot = (
    <span aria-hidden className={META}>
      ·
    </span>
  )
  return (
    <SwipeableRow
      item={item}
      surfaceClassName={cn(
        'group relative flex min-h-14 items-start gap-3.5 rounded-[18px] border border-border-soft bg-card px-4 py-3.5 hover:border-border hover:shadow-card md:grid md:items-center md:gap-4 md:rounded-2xl md:py-3 md:pr-3 md:pl-[18px]',
        arrived
          ? 'motion-safe:animate-arrive motion-reduce:animate-arrive-still'
          : repeatMark?.phase === 'back'
            ? 'animate-arrive-still'
            : 'animate-in duration-200 fade-in',
        justDone && 'border-primary bg-brand-tint hover:border-primary',
        liveDone && 'border-primary bg-brand-tint hover:border-primary',
        actions.prices ? (thumb ? GRID.thumbPrices : GRID.prices) : thumb ? GRID.thumb : GRID.plain,
        rowHighlight(actions, item),
      )}
    >
      <ItemControl
        item={justDone ? { ...item, status: 'done' } : item}
        onToggle={() => {
          actions.toggle(item)
        }}
        className="z-10 mt-px md:mt-0"
      />
      <RowThumb item={item} />
      <div className="min-w-0 flex-1 md:contents">
        {/* En escritorio el enlace va bajo el título; las columnas de la derecha no cambian. */}
        <div className="min-w-0">
          <RowTitle
            item={item}
            className={cn((liveDone || justDone) && 'text-subtle-foreground line-through')}
          />
          {!quiet && <RowNotes notes={item.notes} />}
          {(link ?? author) && (
            <p className="mt-0.5 hidden items-center gap-1.5 md:flex">
              {author}
              {author && link && dot}
              {link}
            </p>
          )}
          {repeat && <p className="mt-0.5 hidden md:flex">{repeat}</p>}
          {bell && <p className="mt-0.5 hidden md:flex">{bell}</p>}
        </div>
        {first || second || link || bell || author ? (
          <div className="mt-1.5 flex min-w-0 items-center gap-2 md:contents">
            {author && (
              <span className="flex items-center gap-2 md:hidden">
                {author}
                {(first ?? link ?? second ?? bell ?? repeat) && dot}
              </span>
            )}
            {first ?? <span className="hidden md:block" />}
            {link && <span className="flex min-w-0 md:hidden">{link}</span>}
            {second ?? <span className="hidden md:block" />}
            {repeat && (
              <span className="flex items-center gap-2 md:hidden">
                <span aria-hidden className={META}>
                  ·
                </span>
                {repeat}
              </span>
            )}
            {bell && (
              <span className="flex items-center gap-2 md:hidden">
                {(first ?? second ?? link ?? repeat) && (
                  <span aria-hidden className={META}>
                    ·
                  </span>
                )}
                {bell}
              </span>
            )}
          </div>
        ) : (
          // Sin nada debajo del título, sus dos columnas siguen ahí: lo de la derecha no se mueve.
          <>
            <span className="hidden md:block" />
            <span className="hidden md:block" />
          </>
        )}
      </div>
      {option ? (
        <OptionAside item={item} mark={option} className="md:w-full" />
      ) : (
        <RowPrice item={item} className={cn('md:w-full', liveDone && 'text-subtle-foreground')} />
      )}
      {actions.prices && !option && !itemPrice(item) && <span className="hidden md:block" />}
      {isDesktop && <ItemRowDotsMenu item={item} />}
    </SwipeableRow>
  )
}
