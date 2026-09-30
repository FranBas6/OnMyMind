import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

import { CHOOSABLE_KINDS, KIND_DESCRIPTIONS, KIND_LABELS, type ChoosableKind } from '../kind'
import { KIND_ICONS } from './kindIcons'

interface KindOptionsProps {
  /** El tipo marcado. */
  value: ChoosableKind
  onChange: (kind: ChoosableKind) => void
  /** Lleva la etiqueta «Por defecto» (el tipo con el que nace en esta lista). */
  defaultKind?: ChoosableKind
  /** Filas de 64 px en la hoja de móvil; de 56 en el popover de escritorio. */
  compact?: boolean
  label: string
}

/**
 * Los tipos de ítem para elegir (diseño 12, T2, T5, D2 y D3): icono de 36 px (radio 11) sobre
 * `fill`, nombre de 15 px/600 y su descripción; el marcado en `brand-tint`, con el icono sobre
 * blanco, el nombre en `primary-strong` y el check a la derecha.
 */
export function KindOptions({
  value,
  onChange,
  defaultKind,
  compact = false,
  label,
}: KindOptionsProps) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-0.5">
      {CHOOSABLE_KINDS.map((kind) => {
        const Icon = KIND_ICONS[kind]
        const selected = kind === value
        return (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              onChange(kind)
            }}
            className={cn(
              'flex shrink-0 items-center gap-3.5 rounded-2xl px-3.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              compact ? 'h-14' : 'h-16',
              selected ? 'bg-brand-tint' : 'hover:bg-fill/60',
            )}
          >
            <span
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-[11px]',
                selected ? 'bg-card' : 'bg-fill',
              )}
            >
              <Icon aria-hidden className="size-[18px] text-foreground" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block text-[15px] font-semibold',
                  selected ? 'text-primary-strong' : 'text-foreground',
                )}
              >
                {KIND_LABELS[kind]}
                {kind === defaultKind && (
                  <span className="ml-1.5 text-[11px] font-bold tracking-[0.05em] text-subtle-foreground uppercase">
                    Por defecto
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-[12.5px] text-subtle-foreground">
                {KIND_DESCRIPTIONS[kind]}
              </span>
            </span>
            {selected && <Check aria-hidden className="size-[18px] text-primary" strokeWidth={3} />}
          </button>
        )
      })}
    </div>
  )
}
