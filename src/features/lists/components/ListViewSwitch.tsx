import { useRef, type KeyboardEvent } from 'react'

import { cn } from '@/lib/utils'

import type { ListView } from '../types'

const OPTIONS: readonly { value: ListView; label: string }[] = [
  { value: 'list', label: 'Lista' },
  { value: 'agenda', label: 'Agenda' },
]

interface ListViewSwitchProps {
  value: ListView
  onChange: (view: ListView) => void
}

/**
 * «Lista · Agenda» en la cabecera de una lista con eventos (5.5, diseño 25, B10 y D5): sobre
 * `fill`, la elegida en una pastilla `card` con sombra. En el móvil va bajo el título; en
 * escritorio, a su derecha. Es un `radiogroup`: las flechas cambian de vista.
 */
export function ListViewSwitch({ value, onChange }: ListViewSwitchProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    if (step === undefined) return
    event.preventDefault()
    const next = (index + step + OPTIONS.length) % OPTIONS.length
    const option = OPTIONS[next]
    if (!option) return
    onChange(option.value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label="Ver como"
      className="flex w-fit shrink-0 gap-0.5 rounded-xl bg-fill p-1"
    >
      {OPTIONS.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              if (!selected) onChange(option.value)
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index)
            }}
            className={cn(
              'h-[30px] rounded-[9px] px-3.5 text-[13px] whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-9 md:rounded-[10px]',
              selected
                ? 'bg-card font-semibold text-foreground shadow-card'
                : 'font-medium text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
