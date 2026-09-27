import { useRef, type KeyboardEvent } from 'react'

import { cn } from '@/lib/utils'

import type { FilterOption } from '../filters'

interface FilterChipsProps<T extends string> {
  label: string
  options: readonly FilterOption<T>[]
  value: T
  onChange: (value: T) => void
}

/**
 * Píldoras de filtro (pantalla 4): la elegida en `foreground` con el texto del fondo, el resto
 * sobre `surface` con borde. Es un `radiogroup` (06 §Accesibilidad): el Tab entra solo en la
 * elegida y las flechas cambian de opción, como en un grupo de radios nativo.
 */
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: FilterChipsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    if (step === undefined) return
    event.preventDefault()
    const next = (index + step + options.length) % options.length
    const option = options[next]
    if (!option) return
    onChange(option.value)
    refs.current[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2">
      {options.map((option, index) => {
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
              onChange(option.value)
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index)
            }}
            className={cn(
              'inline-flex h-9 items-center rounded-full border px-4 text-[13px] font-semibold whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              selected
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-card text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
