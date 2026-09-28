import { Check, Search } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useState, type KeyboardEvent } from 'react'

import { ListIcon } from '@/components/ListIcon'
import { KIND_TEMPLATES, type List } from '@/features/lists'
import { cn } from '@/lib/utils'

import { InboxMark, MoreButton } from './DestinationChip'

interface AllListsProps {
  lists: readonly List[]
  chosenId: string | undefined
  onChoose: (list: List) => void
}

/** «En mente» primero y después las listas en su orden (atajos 0, 1, 2…). */
const ordered = (lists: readonly List[]) => [
  ...lists.filter((list) => list.kind === 'inbox'),
  ...lists.filter((list) => list.kind !== 'inbox'),
]

/** A la derecha de cada lista: el tipo, o lo que tiene sin ordenar «En mente». */
function aside(list: List): string {
  if (list.kind === 'inbox') return `${list.counters.pending} sin ordenar`
  return KIND_TEMPLATES[list.kind].label
}

function Icon({ list }: { list: List }) {
  if (list.kind === 'inbox') {
    return (
      <span aria-hidden className="grid size-[30px] shrink-0 place-items-center">
        <InboxMark className="size-[18px]" />
      </span>
    )
  }
  return <ListIcon name={list.name} color={list.color} size="xs" />
}

/**
 * Móvil (diseño 07, C4): «···» cambia el teclado por todas las listas, en la misma hoja, sin que
 * crezca ni se cierre. Elegir vuelve al teclado con esa lista; «Teclado» vuelve sin cambiar nada.
 */
export function AllListsPanel({
  lists,
  chosenId,
  onChoose,
  onKeyboard,
}: AllListsProps & { onKeyboard: () => void }) {
  return (
    <div className="-mx-[22px] border-t border-border-soft px-[22px] pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-bold tracking-[0.06em] text-subtle-foreground uppercase">
          Todas las listas
        </p>
        <button
          type="button"
          onClick={onKeyboard}
          className="h-9 rounded-lg px-1 text-[13px] font-semibold text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Teclado
        </button>
      </div>
      <ul
        aria-label="Todas las listas"
        className="-mx-2 flex max-h-[45dvh] flex-col overflow-y-auto"
      >
        {ordered(lists).map((list) => {
          const selected = list.id === chosenId
          return (
            <li key={list.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  onChoose(list)
                }}
                className={cn(
                  'flex h-12 w-full items-center gap-3 rounded-xl px-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  selected ? 'bg-brand-tint' : 'hover:bg-fill',
                )}
              >
                <Icon list={list} />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-[15px] font-semibold',
                    selected && 'text-primary-strong',
                  )}
                >
                  {list.name}
                </span>
                <span className="text-xs text-subtle-foreground">{aside(list)}</span>
                {selected && (
                  <Check aria-hidden className="size-4 text-primary" strokeWidth={2.6} />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Escritorio (diseño 07, D5): el «···» abre un popover con buscador y todas las listas, con
 * atajos: 0 para «En mente» y 1 a 9 para las demás, en su orden (con el buscador vacío).
 */
export function AllListsPopover({
  lists,
  chosenId,
  onChoose,
  open,
  onOpenChange,
}: AllListsProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState('')
  const all = ordered(lists)
  const matches = query.trim()
    ? all.filter((list) => list.name.toLowerCase().includes(query.trim().toLowerCase()))
    : all

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
      const list = all[Number(event.key)]
      if (list) {
        event.preventDefault()
        onChoose(list)
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
              placeholder="Buscar lista…"
              aria-label="Buscar lista"
              className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-subtle-foreground"
            />
          </label>
          <ul className="flex max-h-[60dvh] flex-col gap-0.5 overflow-y-auto">
            {matches.map((list) => {
              const selected = list.id === chosenId
              return (
                <li key={list.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChoose(list)
                    }}
                    className={cn(
                      'flex h-11 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm font-semibold outline-none hover:bg-fill focus-visible:bg-fill',
                      selected && 'bg-brand-tint text-primary-strong hover:bg-brand-tint',
                    )}
                  >
                    <Icon list={list} />
                    <span className="min-w-0 flex-1 truncate">{list.name}</span>
                    {query === '' && all.indexOf(list) < 10 && (
                      <kbd
                        aria-hidden
                        className="font-sans text-[11px] font-normal text-subtle-foreground"
                      >
                        {all.indexOf(list)}
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
