import { Check, Search } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useState, type KeyboardEvent } from 'react'

import { ListIcon } from '@/components/ListIcon'
import { filterDestinations, SublistIcon, type Destination } from '@/features/items'
import { cn } from '@/lib/utils'

import { InboxMark, MoreButton } from './DestinationChip'

interface AllListsProps {
  /** Los destinos en su orden (`destinationsOf`): «En mente», y cada lista con sus sublistas. */
  destinations: readonly Destination[]
  chosenId: string | undefined
  onChoose: (destination: Destination) => void
}

function Icon({ destination, size }: { destination: Destination; size: 'xs' | 'row' }) {
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
  if (list.kind === 'inbox') {
    return (
      <span
        aria-hidden
        className={cn(
          'grid shrink-0 place-items-center',
          size === 'row' ? 'size-9 rounded-[11px] bg-brand-tint' : 'size-[30px]',
        )}
      >
        <InboxMark className="size-[18px]" />
      </span>
    )
  }
  return (
    <ListIcon
      name={list.name}
      color={list.color}
      icon={list.icon}
      size={size}
      className={size === 'row' ? 'rounded-[11px]' : undefined}
    />
  )
}

/** «Viajes › Lisboa» con «Viajes ›» en gris, o el nombre de la lista. */
function Name({ destination, selected }: { destination: Destination; selected: boolean }) {
  const paused = destination.sublist?.status === 'paused'
  return (
    <span
      className={cn(
        'block truncate',
        selected ? 'text-primary-strong' : paused ? 'text-muted-foreground' : 'text-foreground',
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

/** Lo que va bajo el nombre en la hoja (A3): lo de «En mente» nace nota (5.4); las pausadas. */
function note(destination: Destination): string | null {
  if (destination.sublist?.status === 'paused') return 'Pausada'
  if (destination.list.kind === 'inbox' && !destination.sublist) {
    return 'Lo de aquí nace nota'
  }
  return null
}

/**
 * Móvil (diseño 12, A3): «···» cambia la captura por «Guardar en», en la misma hoja, con el
 * buscador «Buscar lista o sublista…» y todos los destinos: «En mente», y cada lista seguida de sus
 * sublistas («Viajes › Lisboa»), las pausadas atenuadas. Elegir vuelve a la captura con ese destino
 * y «Listo» vuelve sin cambiar nada (decisión de Fran: sustituye al panel de 07, C4).
 */
export function SaveInSheet({
  destinations,
  chosenId,
  onChoose,
  onDone,
}: AllListsProps & {
  onDone: () => void
}) {
  const [query, setQuery] = useState('')
  const matches = filterDestinations(destinations, query)

  return (
    <div className="flex flex-col gap-2.5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="flex items-center justify-between px-1.5">
        <p className="font-display text-xl font-extrabold tracking-[-0.02em]">Guardar en</p>
        <button
          type="button"
          onClick={onDone}
          className="h-9 rounded-lg px-1 text-sm font-semibold text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Listo
        </button>
      </div>
      <label className="flex h-11 shrink-0 items-center gap-2.5 rounded-[14px] bg-fill px-3.5 text-subtle-foreground">
        <Search aria-hidden className="size-4" strokeWidth={2.2} />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
          }}
          placeholder="Buscar lista o sublista…"
          aria-label="Buscar lista o sublista"
          className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-subtle-foreground"
        />
      </label>
      <ul
        aria-label="Todas las listas"
        className="-mx-1.5 flex max-h-[60dvh] flex-col gap-0.5 overflow-y-auto"
      >
        {matches.map((destination) => {
          const selected = destination.id === chosenId
          const detail = note(destination)
          return (
            <li key={destination.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  onChoose(destination)
                }}
                className={cn(
                  'flex h-13 w-full items-center gap-3 rounded-[14px] px-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  selected ? 'bg-brand-tint' : 'hover:bg-fill',
                )}
              >
                <Icon destination={destination} size="row" />
                <span className="min-w-0 flex-1 text-[15px] font-semibold">
                  <Name destination={destination} selected={selected} />
                  {detail && (
                    <span className="block truncate text-xs font-normal text-subtle-foreground">
                      {detail}
                    </span>
                  )}
                </span>
                {selected && (
                  <Check aria-hidden className="size-[18px] text-primary" strokeWidth={3} />
                )}
              </button>
            </li>
          )
        })}
        {matches.length === 0 && (
          <li className="px-3 py-4 text-sm text-muted-foreground">Nada con «{query.trim()}».</li>
        )}
      </ul>
    </div>
  )
}

/**
 * Escritorio (diseños 07, D5, y 12, D6): el «···» abre un popover con buscador y todos los
 * destinos, las sublistas bajo su lista, con atajos: 0 para «En mente» y 1 a 9 para los demás,
 * en su orden (con el buscador vacío).
 */
export function AllListsPopover({
  destinations,
  chosenId,
  onChoose,
  open,
  onOpenChange,
}: AllListsProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState('')
  const matches = filterDestinations(destinations, query)

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      const first = matches[0]
      if (first) {
        event.preventDefault()
        onChoose(first)
      }
      return
    }
    if (query === '' && /^\d$/.test(event.key)) {
      const destination = destinations[Number(event.key)]
      if (destination) {
        event.preventDefault()
        onChoose(destination)
      }
    }
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setQuery('')
      }}
    >
      <Popover.Trigger asChild>
        <MoreButton active={open} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          side="bottom"
          sideOffset={8}
          collisionPadding={16}
          aria-label="Todas las listas"
          onKeyDown={onKeyDown}
          className="z-[60] w-[300px] rounded-[18px] border border-border-soft bg-popover p-2 text-popover-foreground shadow-popover outline-none"
        >
          <label className="mb-1.5 flex h-10 items-center gap-2.5 rounded-xl bg-fill px-3 text-sm text-subtle-foreground">
            <Search aria-hidden className="size-4" strokeWidth={2.2} />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
              }}
              placeholder="Buscar lista o sublista…"
              aria-label="Buscar lista o sublista"
              className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-subtle-foreground"
            />
          </label>
          <ul className="flex max-h-[60dvh] flex-col gap-0.5 overflow-y-auto">
            {matches.map((destination) => {
              const selected = destination.id === chosenId
              const index = destinations.indexOf(destination)
              return (
                <li key={destination.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChoose(destination)
                    }}
                    className={cn(
                      'flex h-11 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm font-semibold outline-none hover:bg-fill focus-visible:bg-fill',
                      selected && 'bg-brand-tint hover:bg-brand-tint',
                    )}
                  >
                    <Icon destination={destination} size="xs" />
                    <span className="min-w-0 flex-1">
                      <Name destination={destination} selected={selected} />
                    </span>
                    {selected && (
                      <Check aria-hidden className="size-4 text-primary" strokeWidth={3} />
                    )}
                    {!selected && query === '' && index < 10 && (
                      <kbd
                        aria-hidden
                        className="font-sans text-[11px] font-normal text-subtle-foreground"
                      >
                        {index}
                      </kbd>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
