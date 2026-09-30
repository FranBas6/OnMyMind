import {
  ArrowRightLeft,
  Check,
  Circle,
  CircleCheck,
  Contrast,
  Copy,
  Pause,
  Pencil,
  Play,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { useRef, useState, type KeyboardEvent } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import { cn } from '@/lib/utils'

import { rowActions, type RowAction, type RowActionId } from '../rowActions'
import { STATUS_LABELS } from '../status'
import type { Item } from '../types'
import { useItems } from '../hooks/useItems'
import { childrenOf, sublistMeta } from '../sublists'
import { ItemControl } from './ItemControl'
import { useItemActions } from './itemActionsContext'
import { SublistIcon } from './SublistIcon'

const ICONS: Record<RowActionId, LucideIcon> = {
  progress: Contrast,
  reopen: Circle,
  pause: Pause,
  resume: Play,
  finish: CircleCheck,
  rename: Pencil,
  duplicate: Copy,
  move: ArrowRightLeft,
  delete: Trash2,
}

/** En la sublista, «Hecha» es un check suelto (diseño 12, S4): su fila no tiene checkbox. */
const iconFor = (item: Item, action: RowAction): LucideIcon =>
  item.kind === 'sublist' && action.id === 'finish' ? Check : ICONS[action.id]

/** Ejecuta una acción del menú; `anchor` es de dónde sale «Mover a…» en escritorio. */
function useRunAction() {
  const actions = useItemActions()
  return (item: Item, action: RowAction, anchor: HTMLElement | null) => {
    if (action.status) actions.setStatus(item, action.status)
    else if (action.id === 'move') actions.startMove(item, anchor)
    else if (action.id === 'rename') actions.rename(item)
    else if (action.id === 'duplicate') actions.duplicate(item)
    else actions.remove(item)
  }
}

/**
 * Menú de fila en móvil (diseño 06, T9): se abre manteniendo pulsada una fila. Arriba la tarea
 * con su estado, y cuatro acciones; «Borrar» en rojo tras un filete.
 */
export function ItemRowMenuSheet({
  item,
  onClose,
}: {
  item: Item | undefined
  onClose: () => void
}) {
  const { list } = useItemActions()
  const run = useRunAction()
  const [shown, setShown] = useState(item)
  if (item && item !== shown) setShown(item)

  return (
    <BottomSheet
      open={item !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={shown ? `Opciones de «${shown.title}»` : 'Opciones'}
    >
      {shown && (
        <>
          <div className="flex items-center gap-3">
            {shown.kind === 'sublist' ? (
              <SublistIcon color={list.color} className="size-9 rounded-[11px]" />
            ) : (
              <ItemControl
                item={shown}
                onToggle={() => undefined}
                className="pointer-events-none"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg leading-[1.25] font-extrabold tracking-[-0.02em]">
                {shown.title}
              </p>
              <p className="mt-0.5 text-[13px] text-subtle-foreground">
                {shown.kind === 'sublist' ? (
                  <SublistMenuSummary item={shown} listName={list.name} />
                ) : (
                  `${list.name} · ${STATUS_LABELS[shown.status].toLowerCase()}`
                )}
              </p>
            </div>
          </div>
          <div className="-mx-2 flex flex-col gap-0.5">
            {rowActions(shown.kind, shown.status).map((action) => {
              const Icon = iconFor(shown, action)
              const destructive = action.id === 'delete'
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    onClose()
                    run(shown, action, null)
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3.5 text-[15px] font-medium outline-none active:bg-fill',
                    destructive || action.separated
                      ? 'mt-1 h-14 rounded-none border-t border-border-soft pt-1'
                      : 'h-13',
                    destructive ? 'text-destructive' : 'text-foreground',
                  )}
                >
                  <Icon aria-hidden className="size-[18px]" strokeWidth={2} />
                  <span className="flex-1 text-left">{action.label}</span>
                  {action.hint && (
                    <span className="text-xs font-normal text-subtle-foreground">
                      {action.hint}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </BottomSheet>
  )
}

/**
 * Menú de fila en escritorio (diseño 06, D8): un ··· a la derecha que aparece al pasar el ratón
 * (o al llegar con el teclado) y abre un popover con atajos de una letra: E, H, M y ⌫.
 */
export function ItemRowDotsMenu({
  item,
  variant = 'row',
}: {
  item: Item
  /** `header`: el ··· de 44 px siempre visible de la cabecera de una sublista (diseño 12, D5). */
  variant?: 'row' | 'header'
}) {
  const run = useRunAction()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const actions = rowActions(item.kind, item.status)

  const onKeyDown = (event: KeyboardEvent) => {
    const key = event.key === 'Backspace' || event.key === 'Delete' ? '⌫' : event.key.toUpperCase()
    const action = actions.find((entry) => entry.shortcut === key)
    if (!action) return
    event.preventDefault()
    setOpen(false)
    run(item, action, trigger.current)
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          ref={trigger}
          type="button"
          aria-label={`Opciones de «${item.title}»`}
          className={cn(
            'relative z-10 flex items-center justify-center outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50',
            variant === 'row'
              ? 'size-8 gap-[3px] rounded-[10px] opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
              : '-mr-2 size-11 gap-1 rounded-xl',
            open && 'bg-fill opacity-100',
          )}
        >
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className={cn(
                'rounded-full bg-foreground',
                variant === 'row' ? 'size-1' : 'size-[5px]',
              )}
            />
          ))}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          onKeyDown={onKeyDown}
          className="z-50 w-[220px] rounded-2xl border border-border-soft bg-popover p-1.5 text-popover-foreground shadow-popover outline-none"
        >
          {actions.map((action) => {
            const Icon = iconFor(item, action)
            const destructive = action.id === 'delete'
            return (
              <DropdownMenu.Item
                key={action.id}
                onSelect={() => {
                  run(item, action, trigger.current)
                }}
                className={cn(
                  'flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3.5 text-sm font-medium outline-none select-none data-highlighted:bg-fill',
                  (destructive || action.separated) &&
                    'mt-1 rounded-none border-t border-border-soft pt-1',
                  destructive && 'text-destructive',
                )}
              >
                <Icon aria-hidden className="size-4" strokeWidth={2} />
                <span className="flex-1">{action.label}</span>
                <kbd aria-hidden className="font-sans text-[11px] text-subtle-foreground">
                  {action.shortcut}
                </kbd>
              </DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/** «Sublista de Viajes · 5 pendientes · En curso» (diseño 12, S4). */
function SublistMenuSummary({ item, listName }: { item: Item; listName: string }) {
  const { data: items = [] } = useItems(item.listId)
  return <>{`Sublista de ${listName} · ${sublistMeta(item, childrenOf(items, item.id))}`}</>
}
