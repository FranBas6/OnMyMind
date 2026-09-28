import { useRef, type KeyboardEvent } from 'react'

import { cn } from '@/lib/utils'

export interface SegmentOption<T extends string> {
  value: T
  label: string
  /** Clases de la opción elegida (la prioridad lleva su color semántico, diseño pantalla 11). */
  selectedClassName?: string
}

interface SegmentedControlProps<T extends string> {
  label: string
  options: readonly SegmentOption<T>[]
  value: T | null
  onChange: (value: T | null) => void
  /** Si tocar la opción elegida la quita (la prioridad puede quedarse sin nada; el estado, no). */
  allowNone?: boolean
}

/**
 * Control segmentado del detalle (Prioridad y Estado, diseño 06): fondo `fill` de radio 14 con
 * 4 px de relleno y opciones de 36 px. Por defecto la elegida va en `foreground` con el texto
 * del fondo. Es un `radiogroup`: Tab entra en la elegida (o en la primera si no hay ninguna) y
 * las flechas cambian de opción.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  allowNone = false,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const focusable = value === null ? 0 : options.findIndex((option) => option.value === value)

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
    <div role="radiogroup" aria-label={label} className="flex gap-1.5 rounded-[14px] bg-fill p-1">
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
            tabIndex={index === focusable ? 0 : -1}
            onClick={() => {
              onChange(selected && allowNone ? null : option.value)
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index)
            }}
            className={cn(
              'inline-flex h-9 flex-1 items-center justify-center rounded-[11px] text-[13px] whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              selected
                ? (option.selectedClassName ?? 'bg-foreground font-bold text-background')
                : cn(
                    'font-semibold',
                    value === null ? 'text-subtle-foreground' : 'text-muted-foreground',
                  ),
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
