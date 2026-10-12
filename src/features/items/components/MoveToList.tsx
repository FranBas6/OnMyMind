import { Check, Plus, Search } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useState, type KeyboardEvent, type ReactNode } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import { ListIcon } from '@/components/ListIcon'
import { listCounterLabel, useLists, type List } from '@/features/lists'
import { cn } from '@/lib/utils'

import { destinationSummary } from '../copy'
import {
  destinationName,
  destinationShortName,
  destinationsOf,
  filterDestinations,
  listDestination,
  type Destination,
} from '../destinations'
import { useItems } from '../hooks/useItems'
import { useSublists } from '../hooks/useSublists'
import { childrenOf } from '../sublists'
import type { Item } from '../types'
import { DateChip } from './DateChip'
import { PriorityChip } from './PriorityChip'
import { SublistIcon } from './SublistIcon'

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
  /** A una lista, a una sublista o, a su misma lista sin sublista, «Sacar de Lisboa». */
  onMove: (item: Item, to: Destination) => void
  /** «Nueva lista con esto» (solo al ordenar desde «En mente», diseño 05). */
  onMoveToNewList: (item: Item) => void
}

/**
 * «Mover a…» (diseños 05, 06 y 12). En móvil, una hoja: se elige el destino y se confirma con
 * «Mover a Casa». En escritorio, un popover junto a lo que se pulsó: elegir es mover, con atajos
 * 1–9. Las sublistas van bajo su lista, como filas planas con «Viajes ›» en gris (A5); las
 * pausadas, atenuadas. Lo que está dentro de una sublista tiene arriba «Sacar de Lisboa», que lo
 * deja suelto en su lista. Una sublista no va a «En mente» ni dentro de otra. La línea de aviso
 * dice qué se pierde, cómo se guardará desde «En mente» o que una sublista se va con lo suyo.
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
  const sublists = useSublists()
  const all = lists.data
    ? [...(lists.data.inbox ? [lists.data.inbox] : []), ...lists.data.lists]
    : []
  const props = { from, destinations: moveDestinations(target?.item, from, all, sublists) }
  const handlers = { onMove, onMoveToNewList, onClose }

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
            {target && <DesktopMenu item={target.item} {...props} {...handlers} />}
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
      {target && <MobileSheet key={target.item.id} item={target.item} {...props} {...handlers} />}
    </BottomSheet>
  )
}

/** Un destino de la hoja: el de siempre, o «Sacar de Lisboa» (su lista, sin sublista). */
interface MoveOption {
  destination: Destination
  /** Donde ya está: atenuado y sin poder elegirse. */
  here: boolean
  /** «Sacar de Lisboa · se queda en Viajes» (A5). */
  takeOut: string | null
}

/**
 * Los destinos de un ítem. Dentro de una sublista, primero «Sacar de Lisboa» y la sublista actual
 * marcada; su lista no se repite (sacar ya es quedarse en ella). Una sublista solo va a listas.
 * Desde «En mente», ella misma no sale (05 E2).
 */
function moveDestinations(
  item: Item | undefined,
  from: List,
  lists: readonly List[],
  sublists: readonly Item[],
): MoveOption[] {
  if (!item) return []
  if (item.kind === 'sublist') {
    return lists
      .filter((list) => list.kind !== 'inbox')
      .map((list) => ({
        destination: listDestination(list),
        here: list.id === from.id,
        takeOut: null,
      }))
  }
  const parent = item.parentId
    ? sublists.find((sublist) => sublist.id === item.parentId)
    : undefined
  const options = destinationsOf(lists, sublists)
    .filter((destination) => !(from.kind === 'inbox' && destination.id === from.id))
    .filter((destination) => !(item.parentId && destination.id === from.id))
    .map((destination) => ({
      destination,
      here: destination.id === (item.parentId ?? from.id),
      takeOut: null,
    }))
  if (!item.parentId) return options
  const takeOut = parent
    ? `Sacar de ${parent.title} · se queda en ${from.name}`
    : `Se queda en ${from.name}`
  return [{ destination: listDestination(from), here: false, takeOut }, ...options]
}

interface MenuProps {
  item: Item
  from: List
  destinations: MoveOption[]
  onMove: (item: Item, to: Destination) => void
  onMoveToNewList: (item: Item) => void
  onClose: () => void
}

/**
 * La línea de aviso al elegir destino: qué pasa con lo de dentro de una sublista. Mover ya no
 * cambia el tipo ni quita nada (ADR-012), así que no hay más que avisar.
 */
function useHint(item: Item, option: MoveOption | null): string | null {
  const inside = useInside(item)
  if (!option || option.takeOut) return null
  return inside
}

function MobileSheet({ item, from, destinations, onMove, onMoveToNewList, onClose }: MenuProps) {
  const [chosen, setChosen] = useState<MoveOption | null>(null)
  const [query, setQuery] = useState('')
  const hint = useHint(item, chosen)
  const takeOut = destinations.find((option) => option.takeOut)
  const matches = new Set(
    filterDestinations(
      destinations.filter((option) => !option.takeOut).map((option) => option.destination),
      query,
    ).map((destination) => destination.id),
  )
  const shown = destinations.filter(
    (option) => !option.takeOut && matches.has(option.destination.id),
  )
  const where = item.parentId ? destinations.find((option) => option.here)?.destination : undefined

  return (
    <>
      <div>
        <p className="text-xs font-bold tracking-[0.06em] text-subtle-foreground uppercase">
          Mover a…
        </p>
        <p className="mt-1 font-display text-xl leading-[1.25] font-extrabold tracking-[-0.02em]">
          {item.title}
        </p>
        {where && (
          <p className="mt-0.5 text-[13px] text-subtle-foreground">
            Ahora en {destinationName(where)}
          </p>
        )}
        {item.kind === 'task' && (item.priority ?? item.dueAt) && (
          <div className="mt-1.5 flex items-center gap-2">
            {item.priority && <PriorityChip priority={item.priority} />}
            {item.dueAt && <DateChip date={item.dueAt} />}
          </div>
        )}
      </div>

      <SearchBox value={query} onChange={setQuery} />

      <ul aria-label="Listas" className="-mx-2 flex max-h-[45dvh] flex-col gap-0.5 overflow-y-auto">
        {takeOut && (
          <li className="mb-1 border-b border-border-soft pb-1">
            <MobileOption
              option={takeOut}
              selected={chosen === takeOut}
              onChoose={() => {
                setChosen(takeOut)
              }}
            />
          </li>
        )}
        {shown.map((option) => (
          <li key={option.destination.id}>
            <MobileOption
              option={option}
              selected={chosen?.destination.id === option.destination.id && !chosen.takeOut}
              onChoose={() => {
                setChosen(option)
              }}
            />
          </li>
        ))}
        {from.kind === 'inbox' && !query && (
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
          onMove(item, chosen.destination)
        }}
        className="h-13 rounded-2xl bg-primary font-display text-base font-bold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
      >
        {!chosen
          ? 'Elige una lista'
          : chosen.takeOut && where
            ? `Sacar de ${destinationShortName(where)}`
            : `Mover a ${destinationShortName(chosen.destination)}`}
      </button>
    </>
  )
}

/** Lo que va bajo el nombre de un destino. */
function optionNote(option: MoveOption, compact: boolean): string | null {
  const { destination, here, takeOut } = option
  if (takeOut) return takeOut
  if (here) return destination.sublist ? 'Aquí' : 'Ya está aquí'
  if (destination.sublist) {
    if (destination.sublist.status === 'paused') return 'Pausada'
    return compact ? 'Sublista' : null
  }
  if (!compact) return destinationSummary(destination.list)
  return destination.list.kind === 'inbox' ? 'Sin ordenar' : listCounterLabel(destination.list)
}

function MobileOption({
  option,
  selected,
  onChoose,
}: {
  option: MoveOption
  selected: boolean
  onChoose: () => void
}) {
  const note = optionNote(option, false)
  return (
    <button
      type="button"
      disabled={option.here}
      aria-pressed={selected}
      onClick={onChoose}
      className={cn(
        'flex h-14 w-full items-center gap-3 rounded-[14px] px-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        selected ? 'bg-brand-tint' : 'enabled:hover:bg-fill',
        option.here && 'opacity-50',
      )}
    >
      <DestinationIcon destination={option.destination} size="row" />
      <span className="min-w-0 flex-1">
        <DestinationLabel
          destination={option.destination}
          selected={selected}
          className="text-[15px]"
        />
        {note && <span className="block truncate text-xs text-subtle-foreground">{note}</span>}
      </span>
      {option.takeOut && !selected && (
        <span className="text-[13px] font-bold text-primary-strong">Sacar</span>
      )}
      {selected && <Check aria-hidden className="size-[18px] text-primary" strokeWidth={2.6} />}
    </button>
  )
}

function DesktopMenu({ item, from, destinations, onMove, onMoveToNewList, onClose }: MenuProps) {
  const [hovered, setHovered] = useState<MoveOption | null>(null)
  const hint = useHint(item, hovered)
  const choose = (option: MoveOption) => {
    onClose()
    onMove(item, option.destination)
  }

  // Atajos 1–9: el número de cada destino (diseño 05, D2).
  const onKeyDown = (event: KeyboardEvent) => {
    const index = Number(event.key) - 1
    const option = Number.isInteger(index) ? destinations[index] : undefined
    if (!option || option.here) return
    event.preventDefault()
    choose(option)
  }

  return (
    <div onKeyDown={onKeyDown}>
      <p className="px-2.5 pt-1.5 pb-2 text-[11px] font-bold tracking-[0.06em] text-subtle-foreground uppercase">
        Mover a…
      </p>
      <ul aria-label="Listas" className="flex max-h-[60dvh] flex-col gap-0.5 overflow-y-auto">
        {destinations.map((option, index) => (
          <li
            key={option.takeOut ? 'sacar' : option.destination.id}
            className={cn(option.takeOut && 'mb-1 border-b border-border-soft pb-1')}
          >
            <button
              type="button"
              disabled={option.here}
              onClick={() => {
                choose(option)
              }}
              onMouseEnter={() => {
                setHovered(option)
              }}
              onFocus={() => {
                setHovered(option)
              }}
              className={cn(
                'flex h-12 w-full items-center gap-2.5 rounded-xl px-2.5 text-left outline-none hover:bg-brand-tint focus-visible:bg-brand-tint',
                option.here && 'opacity-50',
              )}
            >
              <DestinationIcon destination={option.destination} size="xs" />
              <span className="min-w-0 flex-1">
                <DestinationLabel
                  destination={option.destination}
                  selected={false}
                  className="text-sm"
                />
                <span className="block truncate text-xs text-subtle-foreground">
                  {optionNote(option, true)}
                </span>
              </span>
              {index < 9 && (
                <kbd aria-hidden className="font-sans text-[11px] text-subtle-foreground">
                  {index + 1}
                </kbd>
              )}
            </button>
          </li>
        ))}
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

/** «Buscar lista o sublista…» (A5): 44 px sobre `fill`. */
function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex h-11 shrink-0 items-center gap-2.5 rounded-[14px] bg-fill px-3.5 text-subtle-foreground">
      <Search aria-hidden className="size-4" strokeWidth={2.2} />
      <input
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        placeholder="Buscar lista o sublista…"
        aria-label="Buscar lista o sublista"
        className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-subtle-foreground"
      />
    </label>
  )
}

/** «Viajes › Lisboa» con «Viajes ›» en gris (A3, A5), o el nombre de la lista. */
function DestinationLabel({
  destination,
  selected,
  className,
}: {
  destination: Destination
  selected: boolean
  className?: string
}) {
  const paused = destination.sublist?.status === 'paused'
  return (
    <span
      className={cn(
        'block truncate font-semibold',
        selected ? 'text-primary-strong' : paused ? 'text-muted-foreground' : 'text-foreground',
        className,
      )}
    >
      {destination.sublist ? (
        <>
          <span className="font-medium text-subtle-foreground">{destination.list.name} › </span>
          {destination.sublist.title}
        </>
      ) : (
        destination.list.name
      )}
    </span>
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

/**
 * Icono del destino: el de la lista, el de la sublista en el color de su lista, o el símbolo
 * sobre el tinte índigo para «En mente».
 */
function DestinationIcon({
  destination,
  size,
}: {
  destination: Destination
  size: 'row' | 'xs'
}): ReactNode {
  const { list, sublist } = destination
  if (sublist) {
    return (
      <SublistIcon
        color={list.color}
        size={size === 'row' ? 'md' : 'xs'}
        state={sublist.status === 'paused' ? 'paused' : 'active'}
      />
    )
  }
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

/** Al mover una sublista con cosas dentro: «Se va con las 7 cosas de dentro.» (ADR-010). */
function useInside(item: Item): string | null {
  const { data: items = [] } = useItems(item.listId)
  if (item.kind !== 'sublist') return null
  const count = childrenOf(items, item.id).length
  if (count === 0) return null
  return count === 1 ? 'Se va con la cosa de dentro.' : `Se va con las ${count} cosas de dentro.`
}
