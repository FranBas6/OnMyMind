import {
  ArrowRightLeft,
  Calendar,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  Lock,
  LockOpen,
  Trash2,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react'
import { DropdownMenu, Popover } from 'radix-ui'
import { Fragment, useCallback, useState } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import type { List } from '@/features/lists'
import { useOpenedNote } from '@/features/private'
// Por su ruta y no por el índice: `reminders` usa piezas de `items` y así no hay ciclo.
import { useReminderField } from '@/features/reminders/hooks/useReminderField'
import { useOnline } from '@/hooks/useOnline'
import { formatDueDateLong } from '@/lib/date'
import { LIST_COLOR_BG } from '@/lib/listColors'
import { showUndoToast } from '@/lib/undoToast'
import { cn } from '@/lib/utils'

import { itemMoment } from '../copy'
import { isPastEvent, occurrence } from '../events'
import { PRIORITY_LABELS, PRIORITIES, type Priority } from '../fields'
import { isChoosableKind, type ChoosableKind } from '../kind'
import { useStoreMutation } from '../hooks/useItemMutations'
import { useItems } from '../hooks/useItems'
import { useLinkMetadata } from '../hooks/useLinkMetadata'
import { useRefreshPrice } from '../hooks/useRefreshPrice'
import { hasThumb } from '../photos'
import { cheapestLink, hasLinks, hasStores, linkFromItem, newLink, storeName } from '../stores'
import { isFinalStatus, STATUS_LABELS, STATUSES_BY_KIND } from '../status'
import type { Item, ItemKind, ItemLink, ItemLinkPatch, ItemPatch, ItemStatus } from '../types'
import { DueDatePicker } from './DueDatePicker'
import { EventWhenField } from './EventWhenField'
import { RepeatField } from './RepeatField'
import { ItemControl } from './ItemControl'
import { ItemMedia } from './ItemMedia'
import { ItemTitleField, NotesField } from './ItemTextFields'
import { KindField } from './KindField'
import { NoteTextField } from './NoteTextField'
import { ProtectedKindRow, ProtectedNote } from './ProtectedNote'
import { useRowActionsContext } from './choiceContext'
import { rowActions, type RowActionId } from '../rowActions'
import { PriceAlertCard } from './PriceAlertCard'
import { PriceBlock } from './PriceBlock'
import { LinksSection } from './Links'
import { StoresSection } from './Stores'
import { SegmentedControl, type SegmentOption } from './SegmentedControl'

const PRIORITY_SELECTED: Record<Priority, string> = {
  high: 'bg-priority-high-bg font-bold text-priority-high',
  medium: 'bg-priority-medium-bg font-bold text-priority-medium',
  // Baja no tiene fondo propio (sería el mismo `fill` del control): una píldora blanca.
  low: 'bg-card font-bold text-foreground shadow-xs',
}

const PRIORITY_OPTIONS: readonly SegmentOption<Priority>[] = PRIORITIES.map((priority) => ({
  value: priority,
  label: PRIORITY_LABELS[priority],
  selectedClassName: PRIORITY_SELECTED[priority],
}))

export interface ItemDetailProps {
  item: Item
  list: List
  isDesktop: boolean
  onToggle: (item: Item) => void
  onUpdate: (item: Item, patch: ItemPatch) => void
  /** Abre «Mover a…»; en escritorio, junto al botón que se ha pulsado. */
  onMove: (item: Item, anchor: HTMLElement) => void
  /** Cambia el tipo, con «Ahora es una tarea · Deshacer» (diseño 25, B6). */
  onChangeKind: (item: Item, kind: ItemKind) => void
  /** «Copiar el texto» de una nota (B11b). */
  onCopyText: (item: Item) => void
  /** «Proteger» y «Quitar la protección» de una nota (5.7, diseño 26). */
  onProtect: (item: Item) => void
  onUnprotect: (item: Item) => void
  onDelete: (item: Item) => void
  /** Una nota que se cierra con todo el texto borrado y sin fotos ni enlaces (B2e). */
  onDiscardEmpty: (item: Item) => void
  onClose: () => void
}

/** Lo que tiene fila «Tipo»: los tipos que se eligen; la sublista (2a.4) no se convierte. */
const isChoosable = (item: Item): item is Item & { kind: ChoosableKind } =>
  isChoosableKind(item.kind)

/**
 * Contenido del detalle de un ítem (pantalla 11 y diseño 06). Debajo de las notas, la foto y el
 * enlace (diseño 15); en una compra, su precio (diseño 16); y la fila «Tipo» (diseño 12) para
 * convertirlo en otra cosa. Cada campo se guarda por su cuenta
 * al cambiarlo, sin botón «Guardar». Las tareas tienen prioridad y fecha límite; el resto de
 * tipos, en fase 1, la hoja básica: título, notas, estado, mover y borrar, con una línea que
 * anticipa su ficha completa. Sin «Recordatorio» (fase 2).
 */
export function ItemDetail({
  item,
  list,
  isDesktop,
  onToggle,
  onUpdate,
  onMove,
  onChangeKind,
  onCopyText,
  onProtect,
  onUnprotect,
  onDelete,
  onDiscardEmpty,
  onClose,
}: ItemDetailProps) {
  const done = isFinalStatus(item.status)
  const statusOptions = STATUSES_BY_KIND[item.kind].map((status) => ({
    value: status,
    label: STATUS_LABELS[status],
  }))
  const online = useOnline()
  // Los días con eventos de su lista, para los puntos del calendario (diseño 17, F3).
  const listItems = useItems(item.listId).data
  const eventDays =
    item.kind === 'event'
      ? (listItems ?? []).flatMap((entry) => {
          const at = entry.kind === 'event' && entry.id !== item.id ? occurrence(entry) : null
          return at ? [at] : []
        })
      : []
  // El enlace trae el título, la imagen y, en una compra, el precio: lo usan el bloque de precio y
  // la fila del enlace (diseños 15 y 16).
  const link = useLinkMetadata(item, online, onUpdate)
  // El aviso (diseño 18): en un evento va en «Cuándo»; en una tarea, con la fecha límite.
  const reminder = useReminderField({ item, isDesktop })
  // Una nota protegida (5.7): bloqueada, de la clave anterior o con su texto descifrado.
  const opened = useOpenedNote(item.id, item.sealed)

  // Las tiendas de una compra (2.2b, diseño 19). «Actualizar precio» vive aquí porque lo ven el
  // bloque de precio y cada tienda («Buscando…», «No contestó»).
  const storeMutation = useStoreMutation()
  const { mutate: mutateStores } = storeMutation
  const updateLink = useCallback(
    (target: Item, linkId: string, patch: ItemLinkPatch) => {
      mutateStores({ type: 'update', item: target, linkId, patch })
    },
    [mutateStores],
  )
  const refresh = useRefreshPrice(item, onUpdate, updateLink)
  const [notice, setNotice] = useState<string | null>(null)
  // Lo mismo, sin precio, con los enlaces de lo que no es compra (4.6, diseño 23, D11).
  const addLink = (url: string) => {
    refresh.reset()
    setNotice(null)
    if (hasLinks(item)) {
      mutateStores({ type: 'add', item, links: [newLink(crypto.randomUUID(), url, item.links)] })
      return
    }
    // El segundo: el de siempre pasa a la lista con él (`item_links`).
    const first = linkFromItem(item, crypto.randomUUID())
    if (!first) return
    mutateStores({
      type: 'add',
      item,
      links: [first, newLink(crypto.randomUUID(), url, [first])],
    })
  }
  const removeLink = (removed: ItemLink) => {
    const rest = item.links.filter((entry) => entry.id !== removed.id)
    refresh.reset()
    mutateStores({ type: 'remove', item, linkId: removed.id })
    const next = cheapestLink(rest)
    setNotice(
      removed.id === item.priceLinkId && next && rest.length > 1
        ? `Ahora la más barata es ${storeName(next)}.`
        : null,
    )
    showUndoToast({
      message: item.kind === 'shopping' ? `${storeName(removed)} quitada` : 'Enlace quitado',
      onUndo: () => {
        setNotice(null)
        // Si quedó uno solo, volvió a la cosa: se vuelven a poner los dos.
        mutateStores({ type: 'add', item, links: rest.length > 1 ? [removed] : [...rest, removed] })
      },
    })
  }

  const origin = (
    <span className="flex min-w-0 items-center gap-2 text-[13px] text-subtle-foreground">
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', LIST_COLOR_BG[list.color])} />
      <span className="truncate">
        {list.name} · {itemMoment(item)}
      </span>
      {/* Sin red, lo dice junto al origen (diseño 15, M12): la foto y el título del enlace esperan. */}
      {!online && (
        <span className="flex shrink-0 items-center gap-1 rounded-[7px] bg-fill px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">
          <WifiOff aria-hidden className="size-3" strokeWidth={2.4} />
          Sin conexión
        </span>
      )}
    </span>
  )

  const desktopHeader = (
    <div className="flex items-center justify-between gap-3">
      {origin}
      <span className="flex shrink-0 items-center gap-2">
        <kbd className="rounded-[5px] bg-fill px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">
          Esc
        </kbd>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="grid size-8 place-items-center rounded-[9px] bg-fill text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <X aria-hidden className="size-4" strokeWidth={2.2} />
        </button>
      </span>
    </div>
  )

  const media = item.kind !== 'sublist' && (
    <ItemMedia
      key={`media-${item.id}`}
      item={item}
      isDesktop={isDesktop}
      online={online}
      linkState={link.linkState}
      onAddLink={addLink}
      onUpdate={onUpdate}
    />
  )
  const links = hasLinks(item) && item.kind !== 'shopping' && item.kind !== 'sublist' && (
    <LinksSection
      item={item}
      isDesktop={isDesktop}
      online={online}
      onAdd={addLink}
      onUpdate={(linkId, patch) => {
        updateLink(item, linkId, patch)
      }}
      onRemove={removeLink}
    />
  )
  const kindField = isChoosable(item) && (
    <KindField
      key={`kind-${item.id}`}
      item={item}
      isDesktop={isDesktop}
      onChange={(kind) => {
        onChangeKind(item, kind)
      }}
    />
  )
  const footer = (
    <div className="mt-auto flex h-11 shrink-0 items-center justify-between text-sm font-semibold">
      <button
        type="button"
        onClick={(event) => {
          onMove(item, event.currentTarget)
        }}
        className="-ml-1 flex h-11 items-center gap-2 rounded-xl px-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ArrowRightLeft aria-hidden className="size-4" strokeWidth={2.2} />
        Mover a otra lista
        {isDesktop && <ChevronDown aria-hidden className="size-3.5 opacity-60" />}
      </button>
      <button
        type="button"
        onClick={() => {
          onDelete(item)
        }}
        className="-mr-1 flex h-11 items-center gap-1.5 rounded-xl px-1 text-destructive outline-none hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Trash2 aria-hidden className="size-4" strokeWidth={2.2} />
        Borrar
      </button>
    </div>
  )

  // La ficha de una nota (diseño 25, B2 y D1): un solo texto, sin título aparte ni estado. Arriba,
  // de dónde es y, en el móvil, su ··· y «Listo»; debajo, fotos, enlaces, «Tipo» y mover o borrar.
  if (item.kind === 'note') {
    // Vacía y sin fotos ni enlaces, al cerrarla se borra sola (B2e); con algo, se queda como estaba.
    const hasMedia = hasThumb(item) || item.url !== null || hasLinks(item)
    // Protegida y sin abrir, «Cerrar» en vez de «Listo» (diseño 26, C8): no hay nada que guardar.
    const locked = item.sealed !== null && opened.state !== 'open' && opened.state !== 'opening'
    return (
      <div className="flex min-h-full flex-col gap-4">
        {isDesktop ? (
          desktopHeader
        ) : (
          <div className="-mt-1.5 flex h-9 items-center justify-between gap-3">
            {origin}
            <span className="-mr-1 flex shrink-0 items-center gap-1">
              <NoteMenu
                item={item}
                onAction={(action, anchor) => {
                  if (action === 'toTask') onChangeKind(item, 'task')
                  else if (action === 'move') onMove(item, anchor)
                  else if (action === 'copyText') onCopyText(item)
                  else if (action === 'protect') onProtect(item)
                  else if (action === 'unprotect') onUnprotect(item)
                  else if (action === 'delete') onDelete(item)
                }}
              />
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-lg px-1 text-[15px] font-bold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {locked ? 'Cerrar' : 'Listo'}
              </button>
            </span>
          </div>
        )}
        {item.sealed ? (
          <>
            <ProtectedNote
              item={item}
              isDesktop={isDesktop}
              opened={opened}
              onUpdate={onUpdate}
              onEmptyClose={() => {
                onDiscardEmpty(item)
              }}
            />
            <ProtectedKindRow />
          </>
        ) : (
          <>
            <NoteTextField
              key={item.id}
              item={item}
              onSave={(note) => {
                onUpdate(item, note)
              }}
              onEmptyClose={() => {
                if (!hasMedia) onDiscardEmpty(item)
              }}
            />
            {media}
            {links}
            {kindField}
          </>
        )}
        {footer}
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col gap-4">
      {isDesktop && desktopHeader}

      <div className="flex items-start gap-3.5 md:gap-3">
        <ItemControl
          large
          item={item}
          onToggle={() => {
            onToggle(item)
          }}
          className="mt-[3px] md:mt-0.5"
        />
        <ItemTitleField
          key={item.id}
          title={item.title}
          done={done}
          onSave={(title) => {
            onUpdate(item, { title })
          }}
          className="text-[23px] md:text-[22px]"
        />
      </div>
      {!isDesktop && <div className="-mt-2 pl-[42px]">{origin}</div>}

      {/* Lo que importa de un evento, justo bajo el título (diseño 17, F1). */}
      {item.kind === 'event' && (
        <EventWhenField
          item={item}
          isDesktop={isDesktop}
          marked={eventDays}
          onChange={(patch) => {
            onUpdate(item, patch)
          }}
          reminderRow={reminder.row}
          reminderNote={reminder.note}
        />
      )}

      <NotesField
        key={`notes-${item.id}`}
        notes={item.notes}
        onSave={(notes) => {
          onUpdate(item, { notes })
        }}
      />

      {media}

      {hasStores(item) && (
        <StoresSection
          item={item}
          isDesktop={isDesktop}
          online={online}
          refresh={refresh.state}
          onAdd={addLink}
          onUpdate={(linkId, patch) => {
            updateLink(item, linkId, patch)
          }}
          onRemove={removeLink}
          onRetry={(linkId) => {
            void refresh.refreshLink(linkId)
          }}
          onNotice={setNotice}
        />
      )}

      {links}

      {/* Debajo de la foto y del enlace, de donde sale (Fran, 2026-10-01; el diseño 16 lo ponía
          bajo el título). */}
      {item.kind === 'shopping' && (
        <PriceBlock
          key={`price-${item.id}`}
          item={item}
          online={online}
          isDesktop={isDesktop}
          refresh={refresh}
          notice={notice}
          webPrice={link.priceState}
          siteName={link.siteName}
          onUpdate={onUpdate}
        />
      )}

      {/* Bajo el bloque de precio, en las compras que se miran solas (diseño 22, A1). */}
      {item.kind === 'shopping' && <PriceAlertCard item={item} isDesktop={isDesktop} />}

      {kindField}

      {item.kind === 'task' && (
        <>
          <Field label="Prioridad">
            <SegmentedControl
              label="Prioridad"
              options={PRIORITY_OPTIONS}
              value={item.priority}
              allowNone
              onChange={(priority) => {
                onUpdate(item, { priority })
              }}
            />
          </Field>
          {/* La fecha límite y su aviso, juntos (diseño 18, R1): el aviso depende de la fecha. */}
          <div className="flex flex-col gap-2">
            <div className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-card">
              <DueDateField
                item={item}
                isDesktop={isDesktop}
                onChange={(dueAt) => {
                  onUpdate(item, { dueAt })
                }}
              />
              {/* Entre la fecha y el aviso (diseño 21, B1). */}
              <RepeatField
                item={item}
                isDesktop={isDesktop}
                onChange={(patch) => {
                  onUpdate(item, patch)
                }}
              />
              {reminder.row}
            </div>
            {reminder.note}
          </div>
        </>
      )}

      <Field label="Estado">
        {item.kind === 'event' ? (
          <EventStatusField
            item={item}
            onChange={(status) => {
              onUpdate(item, { status })
            }}
          />
        ) : (
          <SegmentedControl<ItemStatus>
            label="Estado"
            options={statusOptions}
            value={item.status}
            onChange={(status) => {
              if (status) onUpdate(item, { status })
            }}
          />
        )}
      </Field>

      {footer}
    </div>
  )
}

const NOTE_MENU_ICONS: Partial<Record<RowActionId, LucideIcon>> = {
  protect: Lock,
  unprotect: LockOpen,
  toTask: Circle,
  move: ArrowRightLeft,
  copyText: Copy,
  delete: Trash2,
}

/**
 * El ··· de la ficha de una nota en el móvil (diseño 25, B2): lo mismo que el menú de su fila
 * (B11b), «Pasar a tarea», «Mover a…», «Copiar el texto» y «Borrar», en un menú sobre la ficha.
 * Antes, «Proteger» (diseño 26, C6), en gris con su porqué si no se puede; protegida, «Quitar la
 * protección», «Mover a…» y «Borrar».
 */
function NoteMenu({
  item,
  onAction,
}: {
  item: Item
  onAction: (action: RowActionId, anchor: HTMLElement) => void
}) {
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null)
  const actions = rowActions(item.kind, item.status, useRowActionsContext(item)).filter(
    (action) => NOTE_MENU_ICONS[action.id],
  )
  const entry =
    'flex h-12 cursor-pointer items-center gap-3 rounded-xl px-3.5 text-[15px] font-medium outline-none select-none data-disabled:cursor-default data-disabled:text-subtle-foreground data-highlighted:bg-fill'
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          ref={setTrigger}
          type="button"
          aria-label={`Opciones de «${item.title}»`}
          className="flex size-10 items-center justify-center gap-[3px] rounded-xl outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:bg-fill"
        >
          {[0, 1, 2].map((dot) => (
            <span key={dot} className="size-1 rounded-full bg-muted-foreground" />
          ))}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-[60] w-[260px] rounded-2xl border border-border-soft bg-popover p-1.5 text-popover-foreground shadow-popover outline-none"
        >
          {actions.map((action) => {
            const Icon = NOTE_MENU_ICONS[action.id] ?? Circle
            const destructive = action.id === 'delete'
            return (
              <Fragment key={action.id}>
                <DropdownMenu.Item
                  disabled={action.disabled !== undefined}
                  onSelect={() => {
                    if (trigger) onAction(action.id, trigger)
                  }}
                  className={cn(
                    entry,
                    destructive && 'mt-1 rounded-none border-t border-border-soft text-destructive',
                  )}
                >
                  <Icon aria-hidden className="size-[18px]" strokeWidth={2} />
                  <span className="flex-1">{action.label}</span>
                  {action.hint && (
                    <span className="text-xs font-normal text-subtle-foreground">
                      {action.hint}
                    </span>
                  )}
                </DropdownMenu.Item>
                {action.disabled && (
                  <p className="px-3.5 pb-1.5 text-xs leading-[1.4] text-muted-foreground">
                    {action.disabled.note}
                  </p>
                )}
              </Fragment>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 text-xs font-bold tracking-[0.06em] text-subtle-foreground uppercase">
        {label}
      </p>
      {children}
    </div>
  )
}

interface DueDateFieldProps {
  item: Item
  isDesktop: boolean
  onChange: (dueAt: Date | null) => void
}

/**
 * Fila «Fecha límite» (diseño 06): «Hoy, 25 sep» en rojo si es hoy o antes, «Sin fecha» en
 * terciario, y la fecha sola si la tarea está hecha. Abre el selector: una hoja encima del
 * detalle en móvil (con «Listo») y un popover bajo la fila en escritorio.
 */
function DueDateField({ item, isDesktop, onChange }: DueDateFieldProps) {
  const [open, setOpen] = useState(false)
  const done = isFinalStatus(item.status)
  const label = item.dueAt ? formatDueDateLong(item.dueAt, { relative: !done }) : null

  const row = (
    <button
      type="button"
      onClick={() => {
        setOpen(true)
      }}
      className={cn(
        'flex h-13 w-full items-center justify-between gap-3 px-4 text-[15px] outline-none hover:bg-fill/50 focus-visible:bg-fill',
        open && isDesktop && 'bg-brand-tint hover:bg-brand-tint',
      )}
    >
      <span className="flex items-center gap-2.5 font-medium">
        <Calendar aria-hidden className="size-4 text-muted-foreground" strokeWidth={2} />
        Fecha límite
      </span>
      <span
        className={cn(
          'flex items-center gap-1.5 font-semibold whitespace-nowrap',
          !label && 'font-medium text-subtle-foreground',
          label?.urgent && 'text-error',
        )}
      >
        {label?.text ?? 'Sin fecha'}
        <ChevronRight aria-hidden className="size-4 text-subtle-foreground" strokeWidth={2} />
      </span>
    </button>
  )

  const picker = (
    <DueDatePicker
      value={item.dueAt}
      onChange={(dueAt) => {
        onChange(dueAt)
        // En escritorio, elegir es terminar; en móvil se confirma con «Listo».
        if (isDesktop) setOpen(false)
      }}
    />
  )

  if (isDesktop) {
    return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Anchor asChild>{row}</Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={8}
            aria-label="Fecha límite"
            className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[320px] rounded-[18px] border border-border-soft bg-popover p-3.5 text-popover-foreground shadow-popover outline-none"
          >
            {picker}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    )
  }

  return (
    <>
      {row}
      <BottomSheet nested open={open} onOpenChange={setOpen} title="Fecha límite">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-xl font-extrabold tracking-[-0.02em]">Fecha límite</p>
          <p className="truncate text-[13px] text-subtle-foreground">{item.title}</p>
        </div>
        {picker}
        <button
          type="button"
          onClick={() => {
            setOpen(false)
          }}
          className="mt-1 h-13 rounded-2xl bg-primary font-display text-base font-bold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Listo
        </button>
      </BottomSheet>
    </>
  )
}

/**
 * El estado de un evento (diseño 17, F1, F10–F12): Próximo y Pasado los pone la fecha, así que
 * «Pasado» no se elige; tú solo cancelas o lo deshaces, y el aviso lo deja deshacer.
 */
function EventStatusField({
  item,
  onChange,
}: {
  item: Item
  onChange: (status: ItemStatus) => void
}) {
  const cancelled = item.status === 'cancelled'
  const past = isPastEvent(item)
  const value = cancelled ? 'cancelled' : past ? 'past' : 'upcoming'
  const options: SegmentOption<'upcoming' | 'past' | 'cancelled'>[] = [
    { value: 'upcoming', label: STATUS_LABELS.upcoming, disabled: past && !cancelled },
    { value: 'past', label: 'Pasado', disabled: true },
    { value: 'cancelled', label: STATUS_LABELS.cancelled },
  ]
  const change = (next: ItemStatus, message: string, back: ItemStatus) => {
    onChange(next)
    showUndoToast({
      message,
      onUndo: () => {
        onChange(back)
      },
    })
  }
  return (
    <SegmentedControl
      label="Estado"
      options={options}
      value={value}
      onChange={(next) => {
        if (next === 'cancelled' && !cancelled) change('cancelled', 'Evento cancelado', item.status)
        if (next === 'upcoming' && cancelled) change('upcoming', 'Vuelve a tu agenda', 'cancelled')
      }}
    />
  )
}
