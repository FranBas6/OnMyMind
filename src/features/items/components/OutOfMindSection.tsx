import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'

import { cn } from '@/lib/utils'

import { checkboxState } from '../status'
import type { Item } from '../types'
import { StatusCheckbox } from './StatusCheckbox'

interface OutOfMindSectionProps {
  items: readonly Item[]
  onToggle: (item: Item) => void
  /** Abierta al entrar (cerrada en «En mente» cuando no queda nada pendiente, diseño 05 E3). */
  defaultOpen: boolean
  /** Con el filtro «Hechas» es lo único que se ve: siempre abierta, sin plegar. */
  collapsible?: boolean
  className?: string
}

/**
 * «Fuera de la cabeza» (02 §Estados): lo terminado, al final, tachado y atenuado, con el
 * contador. Tocar el checkbox lo devuelve a pendiente: hecho no es borrado. El diseño atenúa la
 * fila entera al 60 %, pero así el título no llega a AA; se atenúa el checkbox y el título va en
 * `subtle` (4,6:1).
 */
export function OutOfMindSection({
  items,
  onToggle,
  defaultOpen,
  collapsible = true,
  className,
}: OutOfMindSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const listId = useId()
  const expanded = !collapsible || open

  const label = (
    <>
      Fuera de la cabeza{' '}
      <span className="font-semibold text-subtle-foreground">· {items.length}</span>
    </>
  )

  return (
    <section aria-label="Fuera de la cabeza" className={cn('flex flex-col', className)}>
      <h2 className="text-sm tracking-normal text-muted-foreground">
        {collapsible ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => {
              setOpen((current) => !current)
            }}
            className="flex h-9 items-center gap-1.5 rounded-lg px-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ChevronDown
              aria-hidden
              className={cn('size-3.5 transition-transform duration-200', !open && '-rotate-90')}
              strokeWidth={2.2}
            />
            {label}
          </button>
        ) : (
          <span className="flex h-9 items-center px-1">{label}</span>
        )}
      </h2>
      {expanded && (
        <ul id={listId} className="flex flex-col gap-0.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex min-h-10 animate-in items-center gap-3.5 rounded-[18px] px-4 py-1 duration-200 fade-in md:gap-4 md:rounded-2xl md:px-[18px] md:py-2"
            >
              <StatusCheckbox
                state={checkboxState(item.status)}
                label={item.title}
                onToggle={() => {
                  onToggle(item)
                }}
                className="opacity-60"
              />
              <span className="min-w-0 flex-1 truncate text-[15px] text-subtle-foreground line-through">
                {item.title}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
