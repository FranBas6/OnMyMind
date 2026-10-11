import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  Check,
  Circle,
  CircleCheck,
  CircleDot,
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
import { canStep } from '@/lib/reorder'
import { cn } from '@/lib/utils'

import { rowActions, type RowAction, type RowActionId } from '../rowActions'
import { STATUS_LABELS } from '../status'
import type { Item } from '../types'
import { useItems } from '../hooks/useItems'
import { childrenOf, sublistMeta } from '../sublists'
import { ItemControl } from './ItemControl'
import { useItemActions } from './itemActionsContext'
import { SublistIcon } from './SublistIcon'
import { useRowActionsContext } from './choiceContext'

const ICONS: Record<RowActionId, LucideIcon> = {
  progress: Contrast,
  reopen: Circle,
  pause: Pause,
  resume: Play,
  finish: CircleCheck,
  chooseOne: CircleDot,
  choose: Check,
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
    else if (action.id === 'choose') actions.choose(item)
    else if (action.id === 'chooseOne') actions.setChooseOne(item, !item.chooseOne)
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
  const { list, order } = useItemActions()
  const run = useRunAction()
  const [shown, setShown] = useState(item)
  if (item && item !== shown) setShown(item)
  const context = useRowActionsContext(shown)

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
            {withSteps(
              rowActions(shown.kind, shown.status, context),
              order?.ids.includes(shown.id) ?? false,
            ).map((action) => {
              if (action === STEPS) {
                return (
                  <StepButtons
                    key="steps"
                    canUp={order ? canStep(order.ids, shown.id, 'up') : false}
                    canDown={order ? canStep(order.ids, shown.id, 'down') : false}
                    onStep={(direction) => {
                      order?.step(shown, direction)
                    }}
                  />
                )
              }
              const Icon = iconFor(shown, action)
              const destructive = action.id === 'delete'
              // «Elegir esta» (diseño 24, A4): resaltada, y debajo qué pasa al elegirla.
              if (action.highlight) {
                return (
                  <div key={action.id} className="mb-1 flex flex-col gap-2 px-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        run(shown, action, null)
                      }}
                      className="flex h-13 w-full items-center gap-3 rounded-2xl bg-brand-tint px-3.5 text-[15px] font-semibold text-foreground outline-none active:opacity-80"
                    >
                      <Icon aria-hidden className="size-[18px] text-primary" strokeWidth={2.4} />
                      <span className="flex-1 text-left">{action.label}</span>
                      {action.hint && (
                        <span className="text-xs font-normal text-muted-foreground">
                          {action.hint}
                        </span>
                      )}
                    </button>
                    <p className="px-1 text-[13px] text-muted-foreground">
                      {action.highlight.note}
                    </p>
                  </div>
                )
              }
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
  const { order } = useItemActions()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const actions = rowActions(item.kind, item.status, useRowActionsContext(item))
  const sortable = order?.ids.includes(item.id) ?? false

  const onKeyDown = (event: KeyboardEvent) => {
    if (sortable && event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      order?.step(item, event.key === 'ArrowUp' ? 'up' : 'down')
      return
    }
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
          {withSteps(actions, sortable).map((action) => {
            if (action === STEPS) {
              return (
                <DropdownMenu.Group key="steps" className="mt-1 border-t border-border-soft pt-1">
                  {(['up', 'down'] as const).map((direction) => (
                    <DropdownMenu.Item
                      key={direction}
                      disabled={!order || !canStep(order.ids, item.id, direction)}
                      onSelect={(event) => {
                        // Se queda abierto para subir o bajar varias veces.
                        event.preventDefault()
                        order?.step(item, direction)
                      }}
                      className="flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3.5 text-sm font-medium outline-none select-none data-disabled:cursor-default data-disabled:opacity-40 data-highlighted:bg-fill"
                    >
                      {direction === 'up' ? (
                        <ArrowUp aria-hidden className="size-4" strokeWidth={2} />
                      ) : (
                        <ArrowDown aria-hidden className="size-4" strokeWidth={2} />
                      )}
                      <span className="flex-1">{direction === 'up' ? 'Subir' : 'Bajar'}</span>
                      <kbd aria-hidden className="font-sans text-[11px] text-subtle-foreground">
                        {direction === 'up' ? '⌥↑' : '⌥↓'}
                      </kbd>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Group>
              )
            }
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

/** El hueco de «Subir» y «Bajar» entre las acciones: justo antes de «Borrar» (diseño 14, R4 y D3). */
const STEPS = 'steps'

function withSteps(actions: readonly RowAction[], sortable: boolean): (RowAction | typeof STEPS)[] {
  if (!sortable) return [...actions]
  const at = actions.findIndex((action) => action.id === 'delete')
  return at < 0 ? [...actions, STEPS] : [...actions.slice(0, at), STEPS, ...actions.slice(at)]
}

/**
 * «Subir» y «Bajar» en la hoja del menú (diseño 14, R4): uno junto al otro, en dos tarjetas. La
 * hoja se queda abierta para pulsar varias veces. Lo primero no sube y lo último no baja.
 */
function StepButtons({
  canUp,
  canDown,
  onStep,
}: {
  canUp: boolean
  canDown: boolean
  onStep: (direction: 'up' | 'down') => void
}) {
  const button = (direction: 'up' | 'down', enabled: boolean) => (
    <button
      type="button"
      disabled={!enabled}
      onClick={() => {
        onStep(direction)
      }}
      className="flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl border border-border-soft bg-background text-[15px] font-semibold outline-none active:bg-fill disabled:opacity-40"
    >
      {direction === 'up' ? (
        <ArrowUp aria-hidden className="size-[18px]" strokeWidth={2.2} />
      ) : (
        <ArrowDown aria-hidden className="size-[18px]" strokeWidth={2.2} />
      )}
      {direction === 'up' ? 'Subir' : 'Bajar'}
    </button>
  )
  return (
    <div className="mt-1.5 flex gap-2 px-2">
      {button('up', canUp)}
      {button('down', canDown)}
    </div>
  )
}

/** «Sublista de Viajes · 5 pendientes · En curso» (diseño 12, S4). */
function SublistMenuSummary({ item, listName }: { item: Item; listName: string }) {
  const { data: items = [] } = useItems(item.listId)
  return <>{`Sublista de ${listName} · ${sublistMeta(item, childrenOf(items, item.id))}`}</>
}
