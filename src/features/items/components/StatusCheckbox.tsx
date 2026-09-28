import { Check } from 'lucide-react'

import { LIST_COLOR_BORDER, type ListColor } from '@/lib/listColors'
import { cn } from '@/lib/utils'

import type { CheckboxState } from '../status'

interface StatusCheckboxProps {
  state: CheckboxState
  /** El título del ítem: es lo que anuncia el lector de pantalla junto al estado. */
  label: string
  onToggle: () => void
  /** El del detalle (diseño 06): 28 px en móvil y 26 en escritorio. */
  large?: boolean
  /** En Hoy, vacío lleva el borde en el color de su lista (pantalla 7). */
  tone?: ListColor
  className?: string
}

/**
 * Checkbox de tres estados (diseño, pantallas 4 y D1): círculo de 24 px vacío con borde `control`
 * (sin empezar), medio relleno en verde azulado (en curso) o índigo con el check (terminado). Al
 * llenarse hace una escala 0,9 → 1 si el sistema no pide menos movimiento. La zona táctil llega a
 * 44 px con un pseudoelemento, sin agrandar el círculo.
 */
export function StatusCheckbox({
  state,
  label,
  onToggle,
  large = false,
  tone,
  className,
}: StatusCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === 'full' ? true : state === 'half' ? 'mixed' : false}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        'relative grid shrink-0 place-items-center rounded-full outline-none before:absolute before:-inset-2.5 before:content-[""] focus-visible:ring-[3px] focus-visible:ring-ring/50',
        large ? 'size-7 md:size-[26px]' : 'size-6',
        state === 'empty' &&
          (tone
            ? cn('border-2 hover:bg-fill', LIST_COLOR_BORDER[tone])
            : 'border-2 border-control hover:border-primary'),
        state === 'half' &&
          'border-2 border-in-progress bg-[linear-gradient(90deg,var(--in-progress)_50%,transparent_50%)] hover:brightness-110',
        state === 'full' &&
          'bg-primary text-primary-foreground hover:bg-primary-hover motion-safe:animate-check-pop',
        className,
      )}
    >
      {state === 'full' && (
        <Check aria-hidden className={large ? 'size-4' : 'size-[13px]'} strokeWidth={3.5} />
      )}
    </button>
  )
}
