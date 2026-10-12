import { ItemPersonMark } from '@/features/sharing/components/ItemPersonMark'
import { useLiveRow } from '@/features/sharing/hooks/useLiveRow'
import { formatCaptureAge } from '@/lib/date'
import { cn } from '@/lib/utils'

import { noteBody } from '../noteText'
import { hasThumb } from '../photos'
import type { Item } from '../types'
import { ItemControl } from './ItemControl'
import { rowHighlight, useItemActions } from './itemActionsContext'
import { ItemRowDotsMenu } from './ItemRowMenu'
import { LinkMeta, RowThumb } from './RowMedia'
import { RowNotes, RowTitle } from './RowTitle'
import { SwipeableRow } from './SwipeableRow'

/**
 * La fila de una nota (diseño 25, B1, B1b y D1), en cualquier lista. En el sitio de la casilla, la
 * hoja (20 px, `muted`), que no es un control: una nota no se marca. La primera línea en 600 y
 * debajo el principio del resto, en una línea o dos si es larga, con las viñetas juntas con «•».
 * En «En mente», la antigüedad de la captura («hace 2 h», «ayer») a la derecha del título. Con
 * foto, su miniatura; con enlace, su dominio. Tocarla abre la ficha; mantenerla pulsada, el menú;
 * deslizarla a la izquierda, «Mover» y «Borrar» (B11).
 */
export function NoteRow({ item }: { item: Item }) {
  const actions = useItemActions()
  const inbox = actions.list.kind === 'inbox'
  const { person, arrived } = useLiveRow(item)
  const link = item.url ? <LinkMeta url={item.url} item={item} /> : null
  return (
    <SwipeableRow
      item={item}
      surfaceClassName={cn(
        'group relative flex min-h-[58px] items-start gap-3.5 rounded-[18px] border border-border-soft bg-card py-2.5 pr-4 pl-4 hover:border-border hover:shadow-card md:min-h-15 md:items-center md:gap-4 md:rounded-2xl md:py-3 md:pr-3 md:pl-[18px]',
        arrived
          ? 'motion-safe:animate-arrive motion-reduce:animate-arrive-still'
          : 'animate-in duration-200 fade-in',
        rowHighlight(actions, item),
      )}
    >
      <ItemControl item={item} onToggle={() => undefined} className="mt-0.5 md:mt-0" />
      {hasThumb(item) && <RowThumb item={item} />}
      <div className="min-w-0 flex-1 self-center">
        <div className="flex min-w-0 items-baseline gap-2">
          <RowTitle item={item} className="min-w-0 flex-1 truncate font-semibold" />
          {person && (
            <span className="relative z-10 flex shrink-0 self-center">
              <ItemPersonMark person={person} item={item} />
            </span>
          )}
          {inbox && (
            <span className="shrink-0 text-xs whitespace-nowrap text-subtle-foreground">
              <span className="sr-only">Capturada </span>
              {formatCaptureAge(item.createdAt)}
            </span>
          )}
        </div>
        <RowNotes notes={noteBody(item)} lines={2} className="text-[13.5px]" />
        {link && (
          <p className="mt-1 flex min-w-0 text-xs font-semibold text-muted-foreground md:text-[13px]">
            {link}
          </p>
        )}
      </div>
      {actions.isDesktop && <ItemRowDotsMenu item={item} />}
    </SwipeableRow>
  )
}
