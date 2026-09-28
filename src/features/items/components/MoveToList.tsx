import { Check, Plus } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useState, type KeyboardEvent, type ReactNode } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import { ListIcon } from '@/components/ListIcon'
import { KIND_TEMPLATES, useLists, type List } from '@/features/lists'
import { cn } from '@/lib/utils'

import { destinationSummary, moveHint } from '../copy'
import { moveLoss } from '../move'
import type { Item } from '../types'
import { DateChip } from './DateChip'
import { PriorityChip } from './PriorityChip'

export interface MoveTarget {
  item: Item
  /** Dónde se pulsó (escritorio: el popover sale de ahí). */
  anchor: HTMLElement | null
}

interface MoveToListProps {
  from: List
  target: MoveTarget | null
  isDesktop: boolean
  onClose: () => void
  onMove: (item: Item, to: List) => void
  /** «Nueva lista con esto» (solo al ordenar desde «En mente», diseño 05). */
  onMoveToNewList: (item: Item) => void
}

/**
 * «Mover a…» (diseños 05 y 06). En móvil, una hoja: se elige el destino y se confirma con
 * «Mover a Casa». En escritorio, un popover junto a lo que se pulsó: elegir es mover, con atajos
 * 1–9. La lista actual sale atenuada con «Ya está aquí» (en «En mente» ni sale, porque ahí todo
 * se va). La línea de aviso dice qué se pierde o, desde «En mente», cómo se guardará.
 */
export function MoveToList({
  from,
  target,
  isDesktop,
  onClose,
  onMove,
  onMoveToNewList,
}: MoveToListProps) {
  const lists = useLists()
  const all = lists.data
    ? [...(lists.data.inbox ? [lists.data.inbox] : []), ...lists.data.lists]
    : []
  const destinations = from.kind === 'inbox' ? all.filter((list) => list.id !== from.id) : all
  const props = { from, destinations, onMove, onMoveToNewList, onClose }

  if (isDesktop) {
    return (
      <Popover.Root
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
      >
        {target?.anchor && <Popover.Anchor virtualRef={{ current: target.anchor }} />}
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={8}
            collisionPadding={16}
            aria-label="Mover a…"
            className="z-50 w-[300px] rounded-[18px] border border-border-soft bg-popover p-2 text-popover-foreground shadow-popover outline-none"
          >
            {target && <DesktopMenu item={target.item} {...props} />}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    )
  }

  return (
    <BottomSheet
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={target ? `Mover «${target.item.title}» a…` : 'Mover a…'}
    >
      {target && <MobileSheet key={target.item.id} item={target.item} {...props} />}
    </BottomSheet>
  )
}

interface MenuProps {
  item: Item
  from: List
  destinations: List[]
  onMove: (item: Item, to: List) => void
  onMoveToNewList: (item: Item) => void
  onClose: () => void
}

function MobileSheet({ item, from, destinations, onMove, onMoveToNewList, onClose }: MenuProps) {
  const [chosen, setChosen] = useState<List | null>(null)
  const hint = chosen ? moveHint(from.kind, chosen, moveLoss(item, chosen.kind)) : null

  return (
    <>
      <div>
        <p className="text-xs font-bold tracking-[0.06em] text-subtle-foreground uppercase">
          Mover a…
        </p>
        <p className="mt-1 font-display text-xl leading-[1.25] font-extrabold tracking-[-0.02em]">
          {item.title}
        </p>
        {from.kind === 'tasks' && (item.priority ?? item.dueAt) && (
          <div className="mt-1.5 flex items-center gap-2">
            {item.priority && <PriorityChip priority={item.priority} />}
            {item.dueAt && <DateChip date={item.dueAt} />}
          </div>
        )}
      </div>

      <ul aria-label="Listas" className="-mx-2 flex max-h-[45dvh] flex-col gap-0.5 overflow-y-auto">
        {destinations.map((list) => {
          const here = list.id === from.id
          const selected = chosen?.id === list.id
          return (
            <li key={list.id}>
              <button
                type="button"
                disabled={here}
                aria-pressed={selected}
                onClick={() => {
                  setChosen(list)
                }}
                className={cn(
                  'flex h-14 w-full items-center gap-3 rounded-[14px] px-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  selected && 'bg-brand-tint',
                  here && 'opacity-50',
                )}
              >
                <DestinationIcon list={list} size="row" />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate text-[15px] font-semibold',
                      selected && 'text-primary-strong',
                    )}
                  >
                    {list.name}
                  </span>
                  <span className="block truncate text-xs text-subtle-foreground">
                    {here ? 'Ya está aquí' : destinationSummary(list)}
                  </span>
                </span>
                {selected && (
                  <Check aria-hidden className="size-[18px] text-primary" strokeWidth={2.6} />
                )}
              </button>
            </li>
          )
        })}
        {from.kind === 'inbox' && (
          <li>
            <NewListButton
              onClick={() => {
                onClose()
                onMoveToNewList(item)
              }}
            />
          </li>
        )}
      </ul>

      {hint && <p className="px-1 text-[13px] leading-normal text-muted-foreground">{hint}</p>}

      <button
        type="button"
        disabled={!chosen}
        onClick={() => {
          if (!chosen) return
          onClose()
          onMove(item, chosen)
        }}
        className="h-13 rounded-2xl bg-primary font-display text-base font-bold text-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
      >
        {chosen ? `Mover a ${chosen.name}` : 'Elige una lista'}
      </button>
    </>
  )
}

function DesktopMenu({ item, from, destinations, onMove, onMoveToNewList, onClose }: MenuProps) {
  const [hovered, setHovered] = useState<List | null>(null)
  const hint = hovered ? moveHint(from.kind, hovered, moveLoss(item, hovered.kind)) : null
  const choose = (list: List) => {
    onClose()
    onMove(item, list)
  }

  // Atajos 1–9: el número de cada destino (diseño 05, D2).
  const onKeyDown = (event: KeyboardEvent) => {
    const index = Number(event.key) - 1
    const list = Number.isInteger(index) ? destinations[index] : undefined
    if (!list || list.id === from.id) return
    event.preventDefault()
    choose(list)
  }

  return (
    <div onKeyDown={onKeyDown}>
      <p className="px-2.5 pt-1.5 pb-2 text-[11px] font-bold tracking-[0.06em] text-subtle-foreground uppercase">
        Mover a…
      </p>
      <ul aria-label="Listas" className="flex max-h-[60dvh] flex-col gap-0.5 overflow-y-auto">
        {destinations.map((list, index) => {
          const here = list.id === from.id
          return (
            <li key={list.id}>
              <button
                type="button"
                disabled={here}
                onClick={() => {
                  choose(list)
                }}
                onMouseEnter={() => {
                  setHovered(list)
                }}
                onFocus={() => {
                  setHovered(list)
                }}
                className={cn(
                  'flex h-12 w-full items-center gap-2.5 rounded-xl px-2.5 text-left outline-none hover:bg-brand-tint focus-visible:bg-brand-tint',
                  here && 'opacity-50',
                )}
              >
                <DestinationIcon list={list} size="xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{list.name}</span>
                  <span className="block truncate text-xs text-subtle-foreground">
                    {here
                      ? 'Ya está aquí'
                      : list.kind === 'inbox'
                        ? 'Sin ordenar'
                        : KIND_TEMPLATES[list.kind].label}
                  </span>
                </span>
                {index < 9 && (
                  <kbd aria-hidden className="font-sans text-[11px] text-subtle-foreground">
                    {index + 1}
                  </kbd>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {from.kind === 'inbox' && (
        <div className="mt-1 border-t border-border-soft pt-1">
          <NewListButton
            compact
            onClick={() => {
              onClose()
              onMoveToNewList(item)
            }}
          />
        </div>
      )}
      {hint && (
        <p className="mt-1 border-t border-border-soft px-2.5 pt-2.5 pb-1.5 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

function NewListButton({ compact = false, onClick }: { compact?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-[14px] px-3 text-left font-semibold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        compact ? 'h-11 gap-2.5 px-2.5 text-sm hover:bg-brand-tint' : 'h-14 text-[15px]',
      )}
    >
      {compact ? (
        <Plus aria-hidden className="size-4" strokeWidth={2.4} />
      ) : (
        <span className="grid size-9 place-items-center rounded-[10px] bg-brand-tint">
          <Plus aria-hidden className="size-[18px]" strokeWidth={2.4} />
        </span>
      )}
      Nueva lista con esto
    </button>
  )
}

/** Icono del destino: el de la lista, o el símbolo sobre el tinte índigo para «En mente». */
function DestinationIcon({ list, size }: { list: List; size: 'row' | 'xs' }): ReactNode {
  if (list.kind !== 'inbox') return <ListIcon name={list.name} color={list.color} size={size} />
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center bg-brand-tint',
        size === 'row' ? 'size-9 rounded-[10px]' : 'size-[30px] rounded-[9px]',
      )}
    >
      <img src="/logos/svg/omm-mark.svg" alt="" className="size-[18px] dark:hidden" />
      <img src="/logos/svg/omm-mark-dark.svg" alt="" className="hidden size-[18px] dark:block" />
    </span>
  )
}
