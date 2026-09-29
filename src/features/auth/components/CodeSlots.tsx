import type { SlotProps } from 'input-otp'

import { cn } from '@/lib/utils'

interface CodeSlotsProps {
  slots: SlotProps[]
  invalid: boolean
  checking: boolean
  /** Bloqueadas tras demasiados intentos: sin casilla activa ni cursor. */
  disabled: boolean
}

/**
 * Las seis casillas del código (diseño 11): 60 px de alto, radio 14 y cifras de 26 px. Borde
 * `border` vacías, `foreground` con cifra, `primary` la activa y `error` todas al fallar; al
 * comprobar, al 60 %.
 */
export function CodeSlots({ slots, invalid, checking, disabled }: CodeSlotsProps) {
  return (
    <div className={cn('flex w-full gap-2', checking && 'opacity-60')}>
      {slots.map((slot, index) => (
        <div
          // Las casillas no se reordenan: la posición es su identidad.
          key={index}
          className={cn(
            'relative flex h-15 flex-1 items-center justify-center rounded-[14px] border-[1.5px] bg-card font-display text-[26px] font-extrabold tracking-[-0.02em] transition-colors',
            invalid
              ? 'border-error text-error'
              : slot.isActive && !disabled
                ? 'border-primary text-foreground'
                : slot.char
                  ? 'border-foreground text-foreground'
                  : 'border-border',
          )}
        >
          {slot.char}
          {slot.hasFakeCaret && !disabled && (
            <span aria-hidden className="h-[26px] w-0.5 animate-caret-blink bg-primary" />
          )}
        </div>
      ))}
    </div>
  )
}
